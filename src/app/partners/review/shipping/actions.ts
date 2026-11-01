"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerTools } from "@/lib/owner/data";
import { fieldsFrom } from "@/lib/owner/products";
import { listSuppliers } from "@/commerce/suppliers/supplier";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { draftFrom, parseOrigin, saveDraft } from "@/commerce/shipping-admin";

/*
 * Owner-only shipping draft actions. Re-check the signed-in owner first.
 * They only change the PRIVATE draft: what customers are charged changes
 * only when the exported file replaces src/commerce/data/shipping-origins.json
 * in a reviewed deploy, and live checkout then also needs the new approval code.
 */

const BASE = "/partners/review/shipping";
const back = (q: Record<string, string>, hash = "draft") => `${BASE}?${new URLSearchParams(q).toString()}#${hash}`;

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  return ownerTools(ctx);
}

export async function saveOriginAction(fd: FormData) {
  const tools = await context();
  if (!(await tools.allow("shipping-write", 120, 60 * 60))) redirect(back({ error: "Too many changes in an hour." }));
  const f = fieldsFrom(fd);
  const rev = Number(f.rev);
  const existingId = f.existingId || null;
  const supplierNames = (await listSuppliers(tools.data)).map((s) => s.name);
  const r = await saveDraft(
    tools.data,
    Number.isSafeInteger(rev) ? rev : -1,
    existingId ? `Edited origin ${existingId}` : `Added origin ${f.id}`,
    (d) => {
      const existing = existingId ? (d.origins.find((o) => o.id === existingId) ?? null) : null;
      if (existingId && !existing) return "That origin is no longer in the draft.";
      if (!existingId && d.origins.some((o) => o.id === (f.id ?? "").trim().toLowerCase())) return "An origin with that id already exists.";
      if (!existingId && d.origins.length >= 10) return "Up to 10 origins.";
      const o = parseOrigin(f, { supplierNames, existing });
      if (typeof o === "string") return o;
      return { ...d, origins: existing ? d.origins.map((x) => (x.id === existingId ? o : x)) : [...d.origins, o] };
    },
    SHIPPING_ORIGINS,
  );
  if (!r.ok) redirect(back({ error: r.error.slice(0, 400) }));
  await tools.audit("shipping", "draft", existingId ?? f.id ?? null, `Shipping draft: ${existingId ? `edited ${existingId}` : `added ${f.id}`}`);
  redirect(back({ ok: "Draft saved. Nothing customers pay has changed — see “Apply” below." }));
}

export async function removeOriginAction(fd: FormData) {
  const tools = await context();
  const id = String(fd.get("existingId") ?? "");
  const rev = Number(fd.get("rev"));
  if (id === "funksquish") redirect(back({ error: "Your own studio origin can't be removed (leave its rates empty instead)." }));
  const r = await saveDraft(tools.data, rev, `Removed origin ${id}`, (d) => (d.origins.some((o) => o.id === id) ? { ...d, origins: d.origins.filter((o) => o.id !== id) } : "Already removed."), SHIPPING_ORIGINS);
  if (!r.ok) redirect(back({ error: r.error }));
  await tools.audit("shipping", "draft", id, `Shipping draft: removed ${id}`);
  redirect(back({ ok: "Removed from the draft." }));
}

export async function resetDraftAction(fd: FormData) {
  const tools = await context();
  if (fd.get("confirm") !== "on") redirect(back({ error: "Tick the box to throw away the draft." }));
  const rev = Number(fd.get("rev"));
  const r = await saveDraft(tools.data, rev, "Reset to the live table", () => draftFrom(SHIPPING_ORIGINS), SHIPPING_ORIGINS);
  if (!r.ok) redirect(back({ error: r.error }));
  await tools.audit("shipping", "draft-reset", null, "Shipping draft reset to the live table");
  redirect(back({ ok: "The draft matches the live table again." }));
}
