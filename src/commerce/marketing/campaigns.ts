import { randomBytes } from "node:crypto";
import { updateWithRetry, type KvStore } from "../../lib/storage/kv-core";
import type { Product } from "../types";
import { canPurchase, formatMoney, startingPrice } from "../availability";

/**
 * Drop & restock alert emails — PREPARED, SWITCHED OFF.
 *
 * Only people who confirmed the separate "Drop & restock alerts" list
 * (double opt-in through Brevo) can receive these. A campaign can only be
 * sent when ALL of these hold, checked again on the server at send time:
 *  - it's about something real: every product is in the published catalog;
 *    a restock needs each item actually back in stock AND buyable;
 *  - drop alerts are switched on (code + env), the drops list is connected,
 *    and sending is separately approved (DROP_ALERTS_SENDING=on, Production);
 *  - the email has the unsubscribe link and the business mailing address;
 *  - it hasn't been sent before (the campaign, and the same alert on the
 *    same day, are each claimed once — create-only — before anything is sent).
 * If Brevo accepts the campaign but the send step fails, retrying only sends
 * the SAME Brevo campaign; it never creates a second one.
 */
export type CampaignKind = "drop" | "restock";
export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export interface Campaign {
  id: string;
  rev: number;
  kind: CampaignKind;
  subject: string;
  intro: string;
  productIds: string[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  /** Brevo's campaign id once created (kept so a retry never creates a duplicate). */
  brevoCampaignId: number | null;
  sentAt: string | null;
  error: string | null;
}

export const campaignKey = (id: string) => `marketing/campaign/${id}`;
const sentKey = (k: string) => `marketing/sent/${k}`;
export const CAMPAIGN_ID = /^c_[a-f0-9]{12}$/;

export function newCampaign(kind: CampaignKind, subject: string, intro: string, productIds: string[], now = new Date()): Campaign | string {
  const s = subject.trim();
  if (!s || s.length > 120) return "Subject: 1–120 characters.";
  if (intro.trim().length > 1000) return "Intro: up to 1000 characters.";
  if (!productIds.length || productIds.length > 6) return "Pick 1–6 products.";
  const at = now.toISOString();
  return { id: `c_${randomBytes(6).toString("hex")}`, rev: 1, kind, subject: s, intro: intro.trim(), productIds, status: "draft", createdAt: at, updatedAt: at, brevoCampaignId: null, sentAt: null, error: null };
}

export async function listCampaigns(store: KvStore): Promise<Campaign[]> {
  const keys = await store.list("marketing/campaign/");
  const rows = await Promise.all(keys.map(async (k) => (await store.get<Campaign>(k))?.value));
  return rows.filter((c): c is Campaign => !!c).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------ eligibility ------------------------------ */

export interface SendGate {
  /** Drop alerts switched on (features.dropAlerts or DROP_ALERTS_ENABLED) AND the drops list connected. */
  alertsActive: boolean;
  /** DROP_ALERTS_SENDING === "on". */
  sendingApproved: boolean;
  production: boolean;
  /** Owner two-step sign-in is set up. */
  mfaReady: boolean;
}

export function campaignBlockers(c: Campaign, live: Product[], freeUnits: (variantId: string) => number | null, gate: SendGate): string[] {
  const out: string[] = [];
  const products = c.productIds.map((id) => live.find((p) => p.id === id));
  products.forEach((p, i) => {
    if (!p) out.push(`Product ${c.productIds[i]} isn't on the website (publish it first).`);
    else if (p.publication !== "published") out.push(`${p.name} is a sample, not a real product.`);
  });
  if (c.kind === "restock")
    for (const p of products) {
      if (!p) continue;
      const back = p.variants.some((v) => (freeUnits(v.id) ?? 0) > 0 && canPurchase(p, v));
      if (!back) out.push(`${p.name} isn't back in stock and buyable on the website yet — a restock alert would be untrue.`);
    }
  if (!gate.alertsActive) out.push("Drop alerts aren't switched on, or the drops list isn't connected.");
  if (!gate.sendingApproved) out.push("Sending isn't approved (DROP_ALERTS_SENDING=on for Production).");
  if (!gate.production) out.push("Alerts are only ever sent from the live site, never from a preview.");
  if (!gate.mfaReady) out.push("Set up owner two-step sign-in first.");
  if (c.status === "sent") out.push("Already sent.");
  if (c.status === "sending") out.push("A send is in progress.");
  return out;
}

/* ------------------------------ content ------------------------------ */

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);

/** The email. Brevo replaces {{ unsubscribe }} with each person's own unsubscribe link. */
export function campaignHtml(c: Pick<Campaign, "kind" | "subject" | "intro" | "productIds">, live: Product[], site: { url: string; mailingAddress: string }): string {
  const cards = c.productIds
    .map((id) => live.find((p) => p.id === id))
    .filter((p): p is Product => !!p)
    .map((p) => {
      const img = p.media.find((m) => m.type === "image");
      const price = startingPrice(p);
      const href = `${site.url}/shop/${encodeURIComponent(p.slug)}`;
      return `<tr><td style="padding:12px 0">${img ? `<a href="${esc(href)}"><img src="${esc(site.url + img.src)}" alt="${esc(img.alt)}" width="240" style="border-radius:16px;max-width:100%"></a>` : ""}<p style="margin:8px 0 0;font-size:18px"><a href="${esc(href)}" style="color:#1f5fff"><b>${esc(p.name)}</b></a>${price ? ` · ${esc(formatMoney(price))}` : ""}</p><p style="margin:4px 0 0">${esc(p.shortDescription)}</p></td></tr>`;
    })
    .join("");
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c;max-width:560px;margin:auto">
<h1 style="font-size:24px">${esc(c.subject)}</h1>
${c.intro ? `<p>${esc(c.intro).replace(/\n/g, "<br>")}</p>` : ""}
<table cellpadding="0" cellspacing="0" width="100%">${cards}</table>
<p style="font-size:12px;color:#55607a;margin-top:32px">You're getting this because you signed up for FunkSquish drop &amp; restock alerts and confirmed your email. <a href="{{ unsubscribe }}">Unsubscribe</a> any time — one click.<br>FunkSquish · ${esc(site.mailingAddress)}</p>
</body></html>`;
}

export function contentProblems(html: string): string[] {
  const out: string[] = [];
  if (!html.includes("{{ unsubscribe }}")) out.push("The email has no unsubscribe link.");
  if (!/FunkSquish ·/.test(html)) out.push("The email has no mailing address.");
  return out;
}

/* ------------------------------ sending (Brevo) ------------------------------ */

export interface BrevoCampaignDeps {
  fetch: typeof fetch;
  apiKey: string;
  listId: number;
  sender: { name: string; email: string };
}

export type SendResult = { ok: true; campaign: Campaign } | { ok: false; error: string; campaign?: Campaign };

/**
 * Send a campaign to the drops list, once. `blockers` must be empty (the
 * caller re-checks them on the server right before calling this).
 */
export async function sendCampaign(store: KvStore, id: string, html: string, deps: BrevoCampaignDeps, now = new Date()): Promise<SendResult> {
  const problems = contentProblems(html);
  if (problems.length) return { ok: false, error: problems.join(" ") };
  // 1. Claim the campaign (draft or failed → sending).
  let claimed: Campaign | null = null;
  await updateWithRetry<Campaign>(store, campaignKey(id), (c) => {
    claimed = null; // a retry after a lost compare-and-set must not keep an earlier attempt's claim
    if (!c || (c.status !== "draft" && c.status !== "failed")) return undefined;
    claimed = { ...c, status: "sending", updatedAt: now.toISOString(), rev: c.rev + 1 };
    return claimed;
  });
  if (!claimed) return { ok: false, error: "This campaign was already sent (or is being sent)." };
  const c: Campaign = claimed;
  // 2. The same alert for the same products can only go out once a day, whichever campaign it's in.
  const dedupe = `${c.kind}:${[...c.productIds].sort().join(",")}:${now.toISOString().slice(0, 10)}`;
  if (!c.brevoCampaignId && !(await store.create(sentKey(dedupe), { campaignId: c.id, at: now.toISOString() }))) {
    const owner = (await store.get<{ campaignId: string }>(sentKey(dedupe)))?.value;
    if (owner?.campaignId !== c.id) return finish(store, c, { status: "failed", error: "The same alert for these products already went out today." }, now);
  }
  const headers = { "api-key": deps.apiKey, "Content-Type": "application/json", Accept: "application/json" };
  try {
    // 3. Create the Brevo campaign once; a retry reuses it.
    let brevoId = c.brevoCampaignId;
    if (!brevoId) {
      const res = await deps.fetch("https://api.brevo.com/v3/emailCampaigns", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `FunkSquish ${c.kind} ${c.id}`, subject: c.subject, sender: deps.sender, htmlContent: html, recipients: { listIds: [deps.listId] } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return finish(store, c, { status: "failed", error: `Brevo didn't create the campaign (${res.status}).` }, now);
      brevoId = Number(((await res.json().catch(() => ({}))) as { id?: number }).id);
      if (!Number.isInteger(brevoId)) return finish(store, c, { status: "failed", error: "Brevo didn't return a campaign id." }, now);
      await updateWithRetry<Campaign>(store, campaignKey(id), (cur) => (cur ? { ...cur, brevoCampaignId: brevoId } : undefined));
    }
    // 4. Send it.
    const send = await deps.fetch(`https://api.brevo.com/v3/emailCampaigns/${brevoId}/sendNow`, { method: "POST", headers, signal: AbortSignal.timeout(15_000) });
    if (!send.ok) return finish(store, { ...c, brevoCampaignId: brevoId }, { status: "failed", error: `Brevo didn't send it (${send.status}). Retry sends the same campaign.` }, now);
    return finish(store, { ...c, brevoCampaignId: brevoId }, { status: "sent", error: null, sentAt: now.toISOString() }, now);
  } catch (e) {
    return finish(store, c, { status: "failed", error: (e as Error)?.name === "TimeoutError" ? "Brevo took too long. Retry when it's back." : "Couldn't reach Brevo." }, now);
  }
}

async function finish(store: KvStore, c: Campaign, patch: Partial<Campaign>, now: Date): Promise<SendResult> {
  let saved: Campaign | null = null;
  await updateWithRetry<Campaign>(store, campaignKey(c.id), (cur) => {
    if (!cur) return undefined;
    saved = { ...cur, ...patch, brevoCampaignId: patch.brevoCampaignId ?? c.brevoCampaignId ?? cur.brevoCampaignId, updatedAt: now.toISOString(), rev: cur.rev + 1 };
    return saved;
  });
  const out = saved as Campaign | null;
  return out?.status === "sent" ? { ok: true, campaign: out } : { ok: false, error: out?.error ?? "Couldn't save.", campaign: out ?? undefined };
}
