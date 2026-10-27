"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import {
  OWNER_KINDS,
  adjustStock,
  currentLive,
  endLive,
  releaseCanceled,
  setPaused,
  setTikTokListed,
  startLive,
  undoAdjustment,
  type OwnerKind,
} from "@/commerce/orders/stock-admin";

/*
 * Owner-only inventory actions. Server actions are public endpoints, so each
 * one re-checks the signed-in owner first, and only accepts variants that
 * exist in this mode's catalog (real products on production, test fixtures
 * elsewhere). Nothing here moves money.
 */

const BASE = "/partners/review/inventory";
const BACK = new Set([BASE, `${BASE}/live`, "/partners/review/today"]);

async function context() {
  if (!(await requireReviewer())) redirect("/partners/review");
  return inventoryContext();
}

const back = (fd: FormData) => {
  const b = String(fd.get("back") ?? BASE);
  return BACK.has(b) ? b : BASE;
};
const q = (params: Record<string, string>) => new URLSearchParams(params).toString();
const msg = (s: string) => s.slice(0, 200);
const units = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isSafeInteger(n) ? n : NaN;
};

function variantFrom(ctx: Awaited<ReturnType<typeof inventoryContext>>, fd: FormData, name = "variant") {
  const id = String(fd.get(name) ?? "");
  return ctx.items.find((i) => i.variantId === id) ?? null;
}

/** Sold on TikTok, stock arrived, damaged, lost, returned, set count, correction. */
export async function adjustAction(fd: FormData) {
  const ctx = await context();
  const to = back(fd);
  const item = variantFrom(ctx, fd);
  if (!item) redirect(`${to}?${q({ error: "That item isn't in this catalog." })}`);
  const kind = String(fd.get("kind") ?? "") as OwnerKind;
  if (!(OWNER_KINDS as readonly string[]).includes(kind)) redirect(`${to}?${q({ error: "Choose what happened." })}`);
  const quantity = units(fd.get("quantity"));
  const requestId = String(fd.get("requestId") ?? "");
  const live = await currentLive(ctx.store);
  const r = await adjustStock(ctx.store, {
    variantId: item.variantId,
    sku: item.sku,
    kind,
    quantity: kind === "correction" && fd.get("direction") === "down" ? -quantity : quantity,
    note: String(fd.get("note") ?? ""),
    requestId,
    catalogOnHand: item.catalogOnHand,
    source: live?.variantIds.includes(item.variantId) && kind === "tiktok-sale" ? "live" : "owner",
    force: fd.get("force") === "yes",
  });
  const anchor = `#v-${encodeURIComponent(item.variantId)}`;
  if (!r.ok) {
    if (r.conflict)
      redirect(`${to}?${q({ conflict: item.variantId, kind, quantity: String(quantity), requestId, error: msg(r.error) })}${anchor}`);
    redirect(`${to}?${q({ error: msg(r.error), v: item.variantId })}${anchor}`);
  }
  console.info(`[inventory] ${ctx.mode} ${kind} ${item.sku} ${r.adjustment?.delta ?? 0}${r.duplicate ? " (duplicate ignored)" : ""}`);
  const saved = r.duplicate ? "Already recorded — nothing changed." : `${item.sku}: ${r.adjustment!.onHandBefore} → ${r.adjustment!.onHandAfter} on the shelf.`;
  const warn = r.shortForWebsite ? ` Website orders now need ${r.shortForWebsite} more than you have — contact those customers.` : "";
  redirect(`${to}?${q({ saved: msg(saved + warn), v: item.variantId, ...(r.logged || r.duplicate ? {} : { error: "Saved, but the activity log didn't update. It's still on the item's own history." }) })}${anchor}`);
}

export async function undoAction(fd: FormData) {
  const ctx = await context();
  const to = back(fd);
  const item = variantFrom(ctx, fd);
  if (!item) redirect(to);
  const r = await undoAdjustment(ctx.store, item.variantId, String(fd.get("adjustment") ?? ""));
  redirect(`${to}?${q(r.ok ? { saved: `Undone. ${item.sku} is back to ${r.adjustment!.onHandAfter}.`, v: item.variantId } : { error: msg(r.error), v: item.variantId })}#v-${encodeURIComponent(item.variantId)}`);
}

/** Pause website purchasing for one or several items (TikTok LIVE, damage check…). Counts don't change. */
export async function pauseAction(fd: FormData) {
  const ctx = await context();
  const to = back(fd);
  const ids = fd.getAll("variant").map(String).filter((id) => ctx.items.some((i) => i.variantId === id));
  if (!ids.length) redirect(`${to}?${q({ error: "Choose at least one item to pause." })}`);
  const n = await setPaused(ctx.store, ids, true, String(fd.get("reason") ?? "Paused by owner"), "owner");
  console.info(`[inventory] ${ctx.mode} paused ${n}`);
  redirect(`${to}?${q({ saved: `Paused ${n} item(s) on the website. TikTok isn't affected.` })}`);
}

export async function resumeAction(fd: FormData) {
  const ctx = await context();
  const to = back(fd);
  const ids = fd.getAll("variant").map(String).filter((id) => ctx.items.some((i) => i.variantId === id));
  const n = await setPaused(ctx.store, ids, false, "", "owner");
  redirect(`${to}?${q({ saved: `Back on sale on the website: ${n} item(s).` })}`);
}

export async function tiktokListedAction(fd: FormData) {
  const ctx = await context();
  const item = variantFrom(ctx, fd);
  if (!item) redirect(BASE);
  await setTikTokListed(ctx.store, item.variantId, fd.get("listed") === "yes");
  redirect(`${back(fd)}?${q({ saved: "Saved.", v: item.variantId })}#v-${encodeURIComponent(item.variantId)}`);
}

/** Units still reserved for a canceled website order: make them free again. */
export async function releaseCanceledAction(fd: FormData) {
  const ctx = await context();
  const item = variantFrom(ctx, fd);
  if (!item) redirect(BASE);
  const n = await releaseCanceled(ctx.store, await listOrders(ctx.store), item.variantId);
  redirect(`${back(fd)}?${q({ saved: `Released ${n} unit(s) from canceled orders.`, v: item.variantId })}`);
}

/* ------------------------------ TikTok LIVE ------------------------------ */

export async function startLiveAction(fd: FormData) {
  const ctx = await context();
  const ids = fd.getAll("variant").map(String).filter((id) => ctx.items.some((i) => i.variantId === id));
  const r = await startLive(ctx.store, ids, fd.get("pause") === "yes");
  if (!r.ok) redirect(`${BASE}/live?${q({ error: r.error })}`);
  console.info(`[inventory] ${ctx.mode} LIVE started with ${ids.length} item(s), paused ${r.session.pausedByLive.length}`);
  redirect(`${BASE}/live?${q({ saved: r.session.pausedByLive.length ? `LIVE started. ${r.session.pausedByLive.length} item(s) paused on the website.` : "LIVE started." })}`);
}

export async function endLiveAction(fd: FormData) {
  const ctx = await context();
  const live = await currentLive(ctx.store);
  if (!live) redirect(`${BASE}/live`);
  const rows = live.variantIds.flatMap((id) => {
    const item = ctx.items.find((i) => i.variantId === id);
    if (!item) return [];
    const sales = String(fd.get(`sales-${id}`) ?? "").trim();
    const count = String(fd.get(`count-${id}`) ?? "").trim();
    return [{ variantId: id, sku: item.sku, catalogOnHand: item.catalogOnHand, tiktokSales: sales === "" ? null : units(sales), counted: count === "" ? null : units(count) }];
  });
  if (rows.some((r) => (r.tiktokSales !== null && !(r.tiktokSales >= 0)) || (r.counted !== null && !(r.counted >= 0))))
    redirect(`${BASE}/live?${q({ error: "Use whole numbers (0 or more), or leave a box empty." })}`);
  const r = await endLive(ctx.store, rows, fd.get("resume") === "yes");
  if (!r.ok) redirect(`${BASE}/live?${q({ error: r.error })}`);
  console.info(`[inventory] ${ctx.mode} LIVE ended; ${r.errors.length} problem(s)`);
  redirect(`${BASE}/live?${q(r.errors.length ? { error: msg(r.errors.join(" ")), ended: "1" } : { saved: "LIVE ended and stock reconciled.", ended: "1" })}`);
}
