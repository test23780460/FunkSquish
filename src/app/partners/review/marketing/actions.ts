"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerTools } from "@/lib/owner/data";
import { ownerMfaReady } from "@/lib/owner/mfa-gate";
import { dropAlertsActive } from "@/lib/integrations/status";
import { siteConfig } from "@/lib/site";
import { freshReleaseProducts } from "@/commerce/catalog-release";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { loadStockRows } from "@/commerce/orders/stock-admin";
import { campaignBlockers, campaignHtml, campaignKey, CAMPAIGN_ID, newCampaign, sendCampaign, type Campaign, type CampaignKind } from "@/commerce/marketing/campaigns";

/*
 * Owner-only marketing actions. Re-check the signed-in owner first. Sending
 * re-checks EVERY condition on the server (a real product, really back in
 * stock, alerts switched on, sending approved, production, two-step sign-in)
 * and needs SEND typed; until all of that is true, nothing can be sent.
 */

const BASE = "/partners/review/marketing";
const back = (q: Record<string, string>) => `${BASE}?${new URLSearchParams(q).toString()}#campaigns`;
const address = () => siteConfig.mailingAddress.slice(1).join(", ");

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  return ownerTools(ctx);
}

export async function createCampaignAction(fd: FormData) {
  const tools = await context();
  if (!(await tools.allow("marketing", 60, 60 * 60))) redirect(back({ error: "Too many changes in an hour." }));
  const kind = (fd.get("kind") === "restock" ? "restock" : "drop") as CampaignKind;
  const ids = fd.getAll("product").map(String).filter((x) => /^[a-z0-9][a-z0-9_-]{1,63}$/.test(x));
  const c = newCampaign(kind, String(fd.get("subject") ?? ""), String(fd.get("intro") ?? ""), ids);
  if (typeof c === "string") redirect(back({ error: c }));
  await tools.data.create(campaignKey(c.id), c);
  await tools.audit("marketing", "campaign-draft", c.id, `Drafted a ${kind} alert: "${c.subject}"`);
  redirect(back({ ok: "Draft saved. Nothing has been sent." }));
}

export async function deleteCampaignAction(fd: FormData) {
  const tools = await context();
  const id = String(fd.get("id") ?? "");
  if (!CAMPAIGN_ID.test(id)) redirect(back({}));
  const c = (await tools.data.get<Campaign>(campaignKey(id)))?.value;
  if (!c || c.status !== "draft") redirect(back({ error: "Only unsent drafts can be deleted." }));
  await tools.data.delete(campaignKey(id));
  await tools.audit("marketing", "campaign-deleted", id, `Deleted draft alert "${c.subject}"`);
  redirect(back({ ok: "Draft deleted." }));
}

export async function sendCampaignAction(fd: FormData) {
  const tools = await context();
  const id = String(fd.get("id") ?? "");
  if (!CAMPAIGN_ID.test(id)) redirect(back({}));
  if (String(fd.get("confirm") ?? "").trim() !== "SEND") redirect(back({ error: "Type SEND to send it to everyone on the drops list." }));
  if (!(await tools.allow("marketing-send", 5, 24 * 60 * 60))) redirect(back({ error: "Five sends a day at most." }));
  const c = (await tools.data.get<Campaign>(campaignKey(id)))?.value;
  if (!c) redirect(back({ error: "That campaign no longer exists." }));
  const live = (await freshReleaseProducts()) ?? [];
  const inv = await inventoryContext();
  const rows = await loadStockRows(inv.store, inv.items, { now: new Date() });
  const gate = {
    alertsActive: dropAlertsActive(),
    sendingApproved: process.env.DROP_ALERTS_SENDING === "on",
    production: process.env.BUILD_CONTEXT === "production",
    mfaReady: (await ownerMfaReady()).ready,
  };
  const blockers = campaignBlockers(c, live, (v) => rows.find((r) => r.variantId === v)?.free ?? null, gate);
  if (blockers.length) redirect(back({ error: `Not sent: ${blockers.slice(0, 3).join(" ")}` }));
  const sender = process.env.BREVO_DROPS_SENDER ?? process.env.PARTNER_NOTIFY_FROM ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sender)) redirect(back({ error: "Set BREVO_DROPS_SENDER to a verified Brevo sender address." }));
  const r = await sendCampaign(tools.data, c.id, campaignHtml(c, live, { url: siteConfig.url, mailingAddress: address() }), { fetch, apiKey: process.env.BREVO_API_KEY ?? "", listId: Number(process.env.BREVO_DROPS_LIST_ID), sender: { name: "FunkSquish", email: sender } });
  await tools.audit("marketing", r.ok ? "campaign-sent" : "campaign-failed", c.id, r.ok ? `Sent "${c.subject}" to the drops list` : `Send failed: ${r.error}`);
  redirect(back(r.ok ? { ok: "Sent to the drops list." } : { error: r.error }));
}
