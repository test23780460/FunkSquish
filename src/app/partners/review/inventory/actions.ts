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
import { ownerTools } from "@/lib/owner/data";
import { applyTikTok, parseCounts, parseTikTokOrders, planTikTok, setSupplierStock, stableId, SUPPLIER_STOCK, type SupplierStockState } from "@/commerce/orders/reconcile";
import { dollarsToCents } from "@/commerce/catalog-admin/record";
import { getSupplier } from "@/commerce/suppliers/supplier";

/*
 * Owner-only inventory actions. Server actions are public endpoints, so each
 * one re-checks the signed-in owner first, and only accepts variants that
 * exist in this mode's catalog (real products on production, test fixtures
 * elsewhere). Nothing here moves money.
 */

const BASE = "/partners/review/inventory";
const BACK = new Set([BASE, `${BASE}/live`, `${BASE}/reconcile`, "/partners/review/today"]);

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

/* ------------------------------ reconciliation, restocks, supplier stock ------------------------------ */

const REC = `${BASE}/reconcile`;
const recBack = (params: Record<string, string>, hash = "") => `${REC}?${q(params)}${hash ? `#${hash}` : ""}`;
const MAX_CSV = 2 * 1024 * 1024;

async function tools() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  return ownerTools(ctx);
}

async function csvFrom(fd: FormData, hash: string): Promise<string> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(recBack({ error: "Choose the .csv file." }, hash));
  if (file.size > MAX_CSV) redirect(recBack({ error: "That file is over 2 MB." }, hash));
  return file.text();
}

/** TikTok Shop order export: one "Sold on TikTok" change per order line, at most once ever. */
export async function importTikTokAction(fd: FormData) {
  const ctx = await context();
  const t = await tools();
  if (!(await t.allow("reconcile", 60, 60 * 60))) redirect(recBack({ error: "Too many uploads in an hour." }, "tiktok"));
  const parsed = parseTikTokOrders(await csvFrom(fd, "tiktok"));
  if (parsed.missingColumns.length) redirect(recBack({ error: `Couldn't find these columns: ${parsed.missingColumns.join(", ")}. Use the order export from TikTok Seller Center (Orders, then Export).` }, "tiktok"));
  if (parsed.errors.length) redirect(recBack({ error: msg(`Nothing recorded. Fix these first: ${parsed.errors.slice(0, 5).join("; ")}`) }, "tiktok"));
  const plan = await planTikTok(ctx.store, parsed.lines, ctx.items);
  const count = (a: string) => plan.filter((p) => p.action === a).length;
  const summary = `${count("record-sale")} new sale line(s), ${count("put-back")} cancellation(s) to put back, ${count("already-recorded") + count("already-put-back")} already done, ${count("unknown-sku")} unknown SKU(s), ${count("quantity-changed")} with a changed quantity (check by hand)`;
  if (fd.get("intent") !== "apply") redirect(recBack({ ok: `Check only — nothing recorded. ${summary}.` }, "tiktok"));
  const out = await applyTikTok(ctx.store, plan);
  const applied = out.filter((o) => o.result === "applied").length;
  const held = out.filter((o) => o.result === "held");
  await t.audit("inventory", "tiktok-import", null, `TikTok Shop orders upload: ${applied} stock change(s), ${held.length} held for review`);
  redirect(
    recBack(
      held.length ? { error: msg(`Recorded ${applied}. Held ${held.length} for you to check: ${held.slice(0, 3).map((h) => `${h.row.orderId} ${h.row.sku}: ${h.message}`).join("; ")}`) } : { ok: `Recorded ${applied} stock change(s). ${summary}.` },
      "tiktok",
    ),
  );
}

/** "sku,count" sheet: set counts. The same file twice changes nothing the second time. */
export async function importCountsAction(fd: FormData) {
  const ctx = await context();
  const t = await tools();
  if (!(await t.allow("reconcile", 60, 60 * 60))) redirect(recBack({ error: "Too many uploads in an hour." }, "counts"));
  const text = await csvFrom(fd, "counts");
  const { rows, errors } = parseCounts(text);
  if (errors.length) redirect(recBack({ error: msg(`Nothing saved. ${errors.slice(0, 5).join("; ")}`) }, "counts"));
  const unknown = rows.filter((r) => !ctx.items.some((i) => i.sku.toUpperCase() === r.sku.toUpperCase()));
  if (fd.get("intent") !== "apply")
    redirect(recBack({ ok: `Check only — nothing saved. ${rows.length - unknown.length} count(s) to set${unknown.length ? `, unknown SKUs: ${unknown.map((u) => u.sku).slice(0, 5).join(", ")}` : ""}.` }, "counts"));
  const fileId = stableId("counts", text);
  let set = 0;
  const failed: string[] = [];
  for (const r of rows) {
    const item = ctx.items.find((i) => i.sku.toUpperCase() === r.sku.toUpperCase());
    if (!item) continue;
    const res = await adjustStock(ctx.store, { variantId: item.variantId, sku: item.sku, kind: "count", quantity: r.count, note: r.note ?? "Counted (spreadsheet)", requestId: stableId(fileId, item.sku), catalogOnHand: item.catalogOnHand, force: fd.get("force") === "on" });
    if (res.ok) set += res.duplicate ? 0 : 1;
    else failed.push(`${item.sku}: ${res.error}`);
  }
  await t.audit("inventory", "count-import", null, `Counts spreadsheet: ${set} set, ${failed.length} refused`);
  redirect(recBack(failed.length ? { error: msg(`Set ${set}. Refused: ${failed.slice(0, 3).join("; ")}`) } : { ok: `Set ${set} count(s).` }, "counts"));
}

/** Stock arrived: adds the units and keeps a private restock record (supplier, invoice, unit cost). */
export async function restockAction(fd: FormData) {
  const ctx = await context();
  const t = await tools();
  if (!(await t.allow("inventory-write", 300, 60 * 60))) redirect(recBack({ error: "Too many changes in an hour." }, "restock"));
  const item = variantFrom(ctx, fd);
  if (!item) redirect(recBack({ error: "Pick the item that arrived." }, "restock"));
  const qty = units(fd.get("quantity"));
  const cost = dollarsToCents(String(fd.get("unitCost") ?? ""));
  if (Number.isNaN(cost)) redirect(recBack({ error: "Unit cost: dollars and cents, e.g. 2.40." }, "restock"));
  const supplierId = String(fd.get("supplierId") ?? "") || null;
  if (supplierId && !(await getSupplier(t.data, supplierId))) redirect(recBack({ error: "Pick a supplier from the list." }, "restock"));
  const invoiceRef = String(fd.get("invoiceRef") ?? "").trim().slice(0, 120) || null;
  const requestId = String(fd.get("requestId") ?? "");
  const r = await adjustStock(ctx.store, { variantId: item.variantId, sku: item.sku, kind: "received", quantity: qty, note: invoiceRef ? `Restock · ${invoiceRef}` : "Restock", requestId, catalogOnHand: item.catalogOnHand });
  if (!r.ok) redirect(recBack({ error: msg(r.error) }, "restock"));
  if (!r.duplicate) {
    const at = new Date().toISOString();
    await t.data.create(`restock/${at.slice(0, 10)}/${at}~${requestId}`, { id: requestId, at, variantId: item.variantId, sku: item.sku, quantity: qty, supplierId, invoiceRef, unitCostCents: cost, mode: ctx.mode });
    await t.audit("inventory", "restock", item.sku, `Restock: +${qty} ${item.sku}${invoiceRef ? ` (${invoiceRef})` : ""}`);
  }
  redirect(recBack({ ok: r.duplicate ? "Already recorded." : `Added ${qty} to ${item.sku}.` }, "restock"));
}

/** What a supplier told you about their stock. Out or discontinued pauses the item on the website. */
export async function supplierStockAction(fd: FormData) {
  const ctx = await context();
  const t = await tools();
  const item = variantFrom(ctx, fd);
  if (!item || !item.supplier) redirect(recBack({ error: "Pick a supplier-shipped item." }, "supplier-stock"));
  const state = String(fd.get("state") ?? "") as SupplierStockState;
  if (!(state in SUPPLIER_STOCK)) redirect(recBack({ error: "Pick what the supplier said." }, "supplier-stock"));
  const raw = String(fd.get("quantity") ?? "").trim();
  const quantity = raw ? Number(raw) : null;
  if (quantity !== null && !(Number.isInteger(quantity) && quantity >= 0 && quantity <= 1_000_000)) redirect(recBack({ error: "Quantity: a whole number, or empty." }, "supplier-stock"));
  const r = await setSupplierStock(ctx.store, { variantId: item.variantId, state, quantity, note: String(fd.get("note") ?? "").trim().slice(0, 200) || null });
  await t.audit("inventory", "supplier-stock", item.sku, `Supplier stock for ${item.sku}: ${SUPPLIER_STOCK[state]}${r.paused ? " (paused on the website)" : ""}`);
  redirect(recBack({ ok: `Saved${r.paused ? " — and paused on the website until you resume it" : ""}.` }, "supplier-stock"));
}
