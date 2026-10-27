import { randomUUID } from "node:crypto";
import {
  deductShippedStock,
  effectiveOnHand,
  getLedger,
  heldUnits,
  ledgerKey,
  soldUnits,
  unsellStock,
  type VariantLedger,
} from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { Order } from "./types";

/**
 * Manual, shared inventory (owner decision): ONE physical stock for the
 * website and TikTok Shop, changed by the owner on the private inventory page.
 * No separate TikTok allocation, no automatic TikTok sync, no paid service.
 *
 * Every change is one compare-and-set write on the variant's stock record
 * (the same record website checkouts reserve from), so a TikTok sale and a
 * website checkout can't both take the last unit — but only once the TikTok
 * sale is RECORDED. Manual recording is not instant; see docs/INVENTORY.md for
 * the LIVE routine (pause on the website, then reconcile).
 *
 * Each change is logged (date, quantity, reason, source) on the variant and in
 * a day-by-day activity log. Nothing here touches money or orders' payments.
 */

export type AdjustmentKind =
  | "tiktok-sale"
  | "received"
  | "damaged"
  | "lost"
  | "returned"
  | "count"
  | "correction"
  | "website-shipped"
  | "undo";

export interface InventoryAdjustment {
  id: string;
  at: string;
  variantId: string;
  sku: string;
  kind: AdjustmentKind;
  /** Change to the count (negative = units out). */
  delta: number;
  onHandBefore: number;
  onHandAfter: number;
  /** Who recorded it: the owner, the owner during a TikTok LIVE, or the website (a package shipped). */
  source: "owner" | "live" | "website";
  note?: string;
  orderId?: string;
  /** For undo: the adjustment it reverses. */
  undoes?: string;
  /** Set on the original when it has been undone. */
  undoneBy?: string;
}

export const KIND_LABEL: Record<AdjustmentKind, string> = {
  "tiktok-sale": "Sold on TikTok",
  received: "Stock arrived",
  damaged: "Damaged",
  lost: "Lost / missing",
  returned: "Returned to stock",
  count: "Counted",
  correction: "Correction",
  "website-shipped": "Website order shipped",
  undo: "Undo",
};

/** Owner-entered kinds and the sign of their change. "count" sets the number instead. */
const DIRECTION: Partial<Record<AdjustmentKind, 1 | -1>> = { "tiktok-sale": -1, received: 1, damaged: -1, lost: -1, returned: 1 };
export const OWNER_KINDS = ["tiktok-sale", "received", "damaged", "lost", "returned", "count", "correction"] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

export const MAX_UNITS = 10_000;
const RECENT_PER_VARIANT = 40;
const REQUEST_ID = /^[0-9a-f-]{36}$/;

const logKey = (a: InventoryAdjustment) => `invlog/${a.at.slice(0, 10)}/${a.at}-${a.id}`;

function remember(ledger: VariantLedger, a: InventoryAdjustment) {
  ledger.recent = [a, ...(ledger.recent ?? [])].slice(0, RECENT_PER_VARIANT);
}

/** Durable activity log (best effort after the stock write; the variant's own `recent` list is written atomically). */
async function log(store: KvStore, a: InventoryAdjustment): Promise<boolean> {
  try {
    await store.create(logKey(a), a);
    return true;
  } catch {
    return false;
  }
}

export interface AdjustInput {
  variantId: string;
  sku: string;
  kind: OwnerKind;
  /** Units (for "count": the number counted; for "correction": signed change). */
  quantity: number;
  note?: string;
  /** Random id from the form, so a double-tap or retry records once. */
  requestId: string;
  /** The catalog's count, used until the owner has a managed count. */
  catalogOnHand: number | null;
  source?: "owner" | "live";
  /** Record a decrease even though website orders/checkouts need those units (it really sold on TikTok). */
  force?: boolean;
}

export type AdjustResult =
  | { ok: true; duplicate: boolean; adjustment: InventoryAdjustment | null; shortForWebsite: number; logged: boolean }
  | { ok: false; error: string; conflict?: { onHand: number; sold: number; held: number; free: number } };

/**
 * Record one stock change. Refuses (never silently clamps) anything that
 * would take the count below zero; warns — and needs `force` — when a
 * decrease takes units the website has sold or is holding in a checkout.
 */
export async function adjustStock(store: KvStore, input: AdjustInput, now = new Date()): Promise<AdjustResult> {
  const { variantId, sku, kind, quantity } = input;
  if (!REQUEST_ID.test(input.requestId)) return { ok: false, error: "This form expired. Reload the page and try again." };
  if (!(OWNER_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose what happened." };
  const valid = Number.isSafeInteger(quantity) && (kind === "count" ? quantity >= 0 : kind === "correction" ? quantity !== 0 : quantity >= 1) && Math.abs(quantity) <= MAX_UNITS;
  if (!valid) return { ok: false, error: kind === "count" ? "Enter the number you counted (0 or more)." : "Enter a whole number of units." };
  const note = input.note?.trim().slice(0, 200) || undefined;
  if (kind === "correction" && !note) return { ok: false, error: "Say why you're correcting the count." };

  let result = { ok: false, error: "Couldn't save. Try again." } as AdjustResult; // assigned inside the write below
  let adj: InventoryAdjustment | null = null;
  const nowSec = Math.floor(now.getTime() / 1000);
  await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
    const ledger = current ?? { variantId, entries: {} };
    if ((ledger.recent ?? []).some((a) => a.id === input.requestId)) {
      result = { ok: true, duplicate: true, adjustment: ledger.recent!.find((a) => a.id === input.requestId)!, shortForWebsite: 0, logged: true };
      return undefined;
    }
    const known = effectiveOnHand(ledger, input.catalogOnHand);
    if (known === null && kind !== "count" && kind !== "received") {
      result = { ok: false, error: `${sku} has no starting count yet. Count the shelf and use "Set count" first.` };
      return undefined;
    }
    const before = known ?? 0;
    const after = kind === "count" ? quantity : kind === "correction" ? before + quantity : before + DIRECTION[kind]! * quantity;
    if (after < 0) {
      result = { ok: false, error: `That would take ${sku} below zero — you have ${before}. Count the shelf and use "Set count" instead.` };
      return undefined;
    }
    const sold = soldUnits(ledger);
    const held = heldUnits(ledger, nowSec);
    if (after < before && after < sold + held && !input.force) {
      result = {
        ok: false,
        error: `Only ${Math.max(0, before - sold - held)} of ${sku} are free: ${sold} sold on the website and waiting to ship, ${held} in shoppers' checkouts right now.`,
        conflict: { onHand: before, sold, held, free: Math.max(0, before - sold - held) },
      };
      return undefined;
    }
    adj = {
      id: input.requestId,
      at: now.toISOString(),
      variantId,
      sku,
      kind,
      delta: after - before,
      onHandBefore: before,
      onHandAfter: after,
      source: input.source ?? "owner",
      ...(note ? { note } : {}),
    };
    ledger.onHand = after;
    if (kind === "count") ledger.lastCountedAt = adj.at;
    remember(ledger, adj);
    result = { ok: true, duplicate: false, adjustment: adj, shortForWebsite: Math.max(0, sold - after), logged: false };
    return ledger;
  });
  if (result.ok && !result.duplicate && adj) result.logged = await log(store, adj);
  return result;
}

/**
 * Reverse one of the owner's own changes from the last 24 hours (e.g. a sale
 * recorded on the wrong item during a LIVE). Recorded as its own "undo" entry.
 */
export async function undoAdjustment(store: KvStore, variantId: string, adjustmentId: string, now = new Date()): Promise<AdjustResult> {
  const ledger = await getLedger(store, variantId);
  const original = ledger?.recent?.find((a) => a.id === adjustmentId);
  if (!original) return { ok: false, error: "That change isn't in the recent list any more." };
  if (original.undoneBy) return { ok: false, error: "That change was already undone." };
  if (original.source === "website" || original.kind === "undo") return { ok: false, error: "Only your own changes can be undone." };
  if (now.getTime() - Date.parse(original.at) > 86_400_000) return { ok: false, error: "Only changes from the last 24 hours can be undone. Use a correction instead." };
  let result = { ok: false, error: "Couldn't save. Try again." } as AdjustResult; // assigned inside the write below
  let adj: InventoryAdjustment | null = null;
  await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
    const orig = current?.recent?.find((a) => a.id === adjustmentId);
    if (!current || !orig || orig.undoneBy) return undefined;
    const before = current.onHand ?? 0;
    const after = before - orig.delta;
    if (after < 0) {
      result = { ok: false, error: `Undoing would take ${orig.sku} below zero. Count the shelf instead.` };
      return undefined;
    }
    adj = { id: randomUUID(), at: now.toISOString(), variantId, sku: orig.sku, kind: "undo", delta: -orig.delta, onHandBefore: before, onHandAfter: after, source: "owner", undoes: orig.id };
    orig.undoneBy = adj.id;
    current.onHand = after;
    remember(current, adj);
    result = { ok: true, duplicate: false, adjustment: adj, shortForWebsite: Math.max(0, soldUnits(current) - after), logged: false };
    return current;
  });
  if (result.ok && adj) result.logged = await log(store, adj);
  return result;
}

/** Pause or resume website purchasing for one or more variants. Doesn't change any count. */
export async function setPaused(store: KvStore, variantIds: string[], paused: boolean, reason: string, by: "owner" | "live", now = new Date()): Promise<number> {
  let changed = 0;
  for (const variantId of new Set(variantIds)) {
    const r = await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
      const ledger = current ?? { variantId, entries: {} };
      if (paused && ledger.paused) return undefined;
      if (!paused && !ledger.paused) return undefined;
      // Ending a LIVE only resumes what the LIVE paused, never a pause the owner set by hand.
      if (!paused && by === "live" && ledger.paused?.by !== "live") return undefined;
      ledger.paused = paused ? { at: now.toISOString(), reason: reason.trim().slice(0, 120) || "Paused", by } : null;
      return ledger;
    });
    if (r.changed) changed++;
  }
  return changed;
}

export async function setTikTokListed(store: KvStore, variantId: string, listed: boolean): Promise<void> {
  await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
    const ledger = current ?? { variantId, entries: {} };
    if (!!ledger.tiktokListed === listed) return undefined;
    ledger.tiktokListed = listed;
    return ledger;
  });
}

/**
 * A website package was marked shipped: take its units off the count (once per
 * shipment — updating tracking never deducts again; a replacement shipment has
 * its own key). Logged as "Website order shipped".
 */
export async function deductWebsiteShipment(
  store: KvStore,
  order: Order,
  groupId: string,
  shipmentKey: string,
  catalogOnHand: (variantId: string) => number | null,
  now = new Date(),
): Promise<{ shortfall: { variantId: string; units: number }[] }> {
  const g = order.fulfillments.find((f) => f.id === groupId);
  if (!g) return { shortfall: [] };
  const lines = order.lineItems
    .filter((l) => g.variantIds.includes(l.variantId))
    .map((l) => ({ variantId: l.variantId, sku: l.sku, quantity: l.quantity, onHand: catalogOnHand(l.variantId) }));
  const { shortfall, applied } = await deductShippedStock(
    store,
    order.checkoutId,
    `${order.checkoutId}:${shipmentKey}`,
    lines,
    (ledger, line, before, after) => {
      const a: InventoryAdjustment = {
        id: randomUUID(),
        at: now.toISOString(),
        variantId: line.variantId,
        sku: line.sku,
        kind: "website-shipped",
        delta: after - before,
        onHandBefore: before,
        onHandAfter: after,
        source: "website",
        orderId: order.id,
        ...(before < line.quantity ? { note: `count was ${line.quantity - before} lower than what shipped — set to 0; recount` } : {}),
      };
      remember(ledger, a);
      return a;
    },
    now,
  );
  for (const a of applied) await log(store, a);
  return { shortfall };
}

/* ------------------------------ overview + warnings ------------------------------ */

export interface StockItem {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  variantName: string;
  /** Published on the site (drafts can be stocked before they go up). */
  published: boolean;
  /** Could be bought on the website right now (purchasing on, price, shipping ready), ignoring stock. */
  websiteSellable: boolean;
  supplier: boolean;
}

export type WarningCode = "oversold" | "sold-out" | "low" | "both-channels-low" | "paused-long" | "no-count" | "not-counted-recently" | "reserved-for-canceled";

export interface StockWarning {
  code: WarningCode;
  text: string;
}

export interface StockRow extends StockItem {
  /** Physical units (managed count, or the catalog's until you change it). Null = unknown. */
  onHand: number | null;
  managed: boolean;
  sold: number;
  held: number;
  free: number;
  paused: VariantLedger["paused"];
  tiktok: boolean;
  lastCountedAt: string | null;
  recent: InventoryAdjustment[];
  warnings: StockWarning[];
}

/**
 * The owner's low-stock warning (decision D-INV-1: kept at 5 units by the owner,
 * 2026-10-27). Owner pages only — the public "Only a few left" label is separate
 * (LOW_STOCK_THRESHOLD in src/commerce/availability.ts).
 */
export const LOW_STOCK_WARNING_UNITS = 5;
/** "Only a few left on both channels — pause it on the website": same owner threshold. */
export const BOTH_CHANNELS_WARNING_UNITS = LOW_STOCK_WARNING_UNITS;
const DAY = 86_400_000;

export function stockRow(
  item: StockItem,
  ledger: VariantLedger | null,
  catalogOnHand: number | null,
  ctx: { now: Date; liveVariantIds?: Set<string>; tiktokFromCatalog?: boolean; canceledCheckouts?: Set<string> },
): StockRow {
  const nowSec = Math.floor(ctx.now.getTime() / 1000);
  const onHand = effectiveOnHand(ledger, catalogOnHand);
  const sold = soldUnits(ledger);
  const held = heldUnits(ledger, nowSec);
  const free = Math.max(0, (onHand ?? 0) - sold - held);
  const tiktok = !!ledger?.tiktokListed || !!ctx.tiktokFromCatalog || !!ctx.liveVariantIds?.has(item.variantId);
  const w: StockWarning[] = [];
  if (onHand === null) w.push({ code: "no-count", text: "No starting count — count the shelf and set it." });
  else {
    if (sold > onHand) w.push({ code: "oversold", text: `Website orders need ${sold - onHand} more than you have. Check the shelf, then contact those customers.` });
    else if (free === 0 && !ledger?.paused) w.push({ code: "sold-out", text: "Sold out on the website." });
    else if (free <= LOW_STOCK_WARNING_UNITS) w.push({ code: "low", text: `Low: ${free} left to sell.` });
    if (tiktok && item.websiteSellable && !ledger?.paused && free > 0 && free <= BOTH_CHANNELS_WARNING_UNITS)
      w.push({ code: "both-channels-low", text: `On the website and TikTok with only ${free} left — pause it on the website while you sell it on TikTok.` });
  }
  const stuck = Object.entries(ledger?.entries ?? {}).filter(([id, e]) => e.state === "sold" && ctx.canceledCheckouts?.has(id));
  if (stuck.length) w.push({ code: "reserved-for-canceled", text: `${stuck.reduce((n, [, e]) => n + e.quantity, 0)} unit(s) still reserved for canceled website orders.` });
  if (ledger?.paused && ctx.now.getTime() - Date.parse(ledger.paused.at) > DAY)
    w.push({ code: "paused-long", text: `Paused on the website since ${ledger.paused.at.slice(0, 10)} (${ledger.paused.reason}).` });
  if (onHand !== null && (!ledger?.lastCountedAt || ctx.now.getTime() - Date.parse(ledger.lastCountedAt) > 30 * DAY))
    w.push({ code: "not-counted-recently", text: ledger?.lastCountedAt ? "Not counted in 30 days." : "Never counted here." });
  return {
    ...item,
    onHand,
    managed: typeof ledger?.onHand === "number",
    sold,
    held,
    free,
    paused: ledger?.paused ?? null,
    tiktok,
    lastCountedAt: ledger?.lastCountedAt ?? null,
    recent: ledger?.recent ?? [],
    warnings: w,
  };
}

/** Warnings that need doing something (the rest are reminders). */
export const ACTION_WARNINGS = new Set<WarningCode>(["oversold", "both-channels-low", "reserved-for-canceled", "no-count", "sold-out", "low", "paused-long"]);

export async function loadStockRows(
  store: KvStore,
  items: (StockItem & { catalogOnHand: number | null; tiktokFromCatalog: boolean })[],
  ctx: { now: Date; liveVariantIds?: Set<string>; canceledCheckouts?: Set<string> },
): Promise<StockRow[]> {
  const ledgers = await Promise.all(items.map((i) => getLedger(store, i.variantId)));
  return items.map((i, n) => stockRow(i, ledgers[n], i.catalogOnHand, { ...ctx, tiktokFromCatalog: i.tiktokFromCatalog }));
}

/** Checkouts whose order was canceled (or fully refunded before shipping) — their "sold" units should be free again. */
export function canceledCheckouts(orders: Order[]): Set<string> {
  return new Set(orders.filter((o) => o.status === "canceled" && o.fulfillments.every((f) => !f.shippedAt)).map((o) => o.checkoutId));
}

/** Free units still reserved for a canceled order (fixes "reserved-for-canceled"). Safe to repeat. */
export async function releaseCanceled(store: KvStore, orders: Order[], variantId: string): Promise<number> {
  const ledger = await getLedger(store, variantId);
  const ids = canceledCheckouts(orders);
  let n = 0;
  for (const [checkoutId, e] of Object.entries(ledger?.entries ?? {}))
    if (e.state === "sold" && ids.has(checkoutId)) {
      await unsellStock(store, checkoutId, [variantId]);
      n += e.quantity;
    }
  return n;
}

/** Recent activity across all variants, newest first (last `days` days). */
export async function recentActivity(store: KvStore, now = new Date(), days = 14, limit = 200): Promise<InventoryAdjustment[]> {
  const keys: string[] = [];
  for (let d = 0; d < days; d++) keys.push(...(await store.list(`invlog/${new Date(now.getTime() - d * DAY).toISOString().slice(0, 10)}/`)));
  const newest = keys.sort().reverse().slice(0, limit);
  const rows = await Promise.all(newest.map(async (k) => (await store.get<InventoryAdjustment>(k))?.value));
  return rows.filter((r): r is InventoryAdjustment => !!r);
}

/* ------------------------------ TikTok LIVE sessions ------------------------------ */

export interface LiveSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  variantIds: string[];
  /** Variants this LIVE paused on the website (resumed at the end unless the owner says otherwise). */
  pausedByLive: string[];
  reconciliation?: { variantId: string; recordedSales: number; tiktokSales: number; difference: number; counted: number | null }[];
}

const LIVE_KEY = "inventory/live-session";

export async function currentLive(store: KvStore): Promise<LiveSession | null> {
  const s = (await store.get<LiveSession>(LIVE_KEY))?.value ?? null;
  return s && !s.endedAt ? s : null;
}

export async function lastLive(store: KvStore): Promise<LiveSession | null> {
  return (await store.get<LiveSession>(LIVE_KEY))?.value ?? null;
}

/** Start a LIVE for the items you'll feature; optionally pause them on the website right away (recommended). */
export async function startLive(store: KvStore, variantIds: string[], pauseOnWebsite: boolean, now = new Date()): Promise<{ ok: true; session: LiveSession } | { ok: false; error: string }> {
  const ids = [...new Set(variantIds)].slice(0, 100);
  if (ids.length === 0) return { ok: false, error: "Choose the items you'll show on the LIVE." };
  if (await currentLive(store)) return { ok: false, error: "A LIVE is already running. End it first." };
  const pausedByLive: string[] = [];
  if (pauseOnWebsite)
    for (const id of ids) if ((await setPaused(store, [id], true, "TikTok LIVE", "live", now)) > 0) pausedByLive.push(id);
  const session: LiveSession = { id: randomUUID(), startedAt: now.toISOString(), endedAt: null, variantIds: ids, pausedByLive };
  const existing = await store.get<LiveSession>(LIVE_KEY);
  const ok = existing ? await store.replace(LIVE_KEY, session, existing.etag) : await store.create(LIVE_KEY, session);
  if (!ok) return { ok: false, error: "Couldn't start — try again." };
  return { ok: true, session };
}

/** TikTok sales recorded for a variant since the LIVE started (undone ones excluded). */
export function salesSince(ledger: VariantLedger | null, since: string): number {
  return (ledger?.recent ?? [])
    .filter((a) => a.kind === "tiktok-sale" && a.at >= since && !a.undoneBy)
    .reduce((n, a) => n - a.delta, 0);
}

/**
 * End-of-LIVE reconciliation. For each featured item the owner enters how many
 * TikTok Seller Center says sold (and optionally a shelf count). Any difference
 * with what was recorded during the LIVE is recorded as TikTok sales (or a
 * correction), counts are set, and items the LIVE paused are resumed (unless
 * the owner keeps them paused).
 */
export async function endLive(
  store: KvStore,
  input: { variantId: string; sku: string; tiktokSales: number | null; counted: number | null; catalogOnHand: number | null }[],
  resume: boolean,
  now = new Date(),
): Promise<{ ok: true; session: LiveSession; errors: string[] } | { ok: false; error: string }> {
  const session = await currentLive(store);
  if (!session) return { ok: false, error: "No LIVE is running." };
  const errors: string[] = [];
  const rec: NonNullable<LiveSession["reconciliation"]> = [];
  for (const row of input) {
    if (!session.variantIds.includes(row.variantId)) continue;
    const recorded = salesSince(await getLedger(store, row.variantId), session.startedAt);
    const tiktok = row.tiktokSales ?? recorded;
    const difference = tiktok - recorded;
    if (!Number.isSafeInteger(tiktok) || tiktok < 0) {
      errors.push(`${row.sku}: enter TikTok's number of sales (0 or more).`);
      continue;
    }
    if (difference > 0) {
      const r = await adjustStock(store, { variantId: row.variantId, sku: row.sku, kind: "tiktok-sale", quantity: difference, note: "End-of-LIVE reconciliation", requestId: randomUUID(), catalogOnHand: row.catalogOnHand, source: "live", force: true }, now);
      if (!r.ok) errors.push(`${row.sku}: ${r.error}`);
    } else if (difference < 0) {
      const r = await adjustStock(store, { variantId: row.variantId, sku: row.sku, kind: "correction", quantity: -difference, note: "End-of-LIVE: fewer TikTok sales than recorded", requestId: randomUUID(), catalogOnHand: row.catalogOnHand, source: "live" }, now);
      if (!r.ok) errors.push(`${row.sku}: ${r.error}`);
    }
    if (row.counted !== null) {
      const r = await adjustStock(store, { variantId: row.variantId, sku: row.sku, kind: "count", quantity: row.counted, note: "End-of-LIVE shelf count", requestId: randomUUID(), catalogOnHand: row.catalogOnHand, source: "live", force: true }, now);
      if (!r.ok) errors.push(`${row.sku}: ${r.error}`);
    }
    rec.push({ variantId: row.variantId, recordedSales: recorded, tiktokSales: tiktok, difference, counted: row.counted });
  }
  if (resume) await setPaused(store, session.pausedByLive, false, "", "live", now);
  const ended: LiveSession = { ...session, endedAt: now.toISOString(), reconciliation: rec };
  const existing = await store.get<LiveSession>(LIVE_KEY);
  if (existing) await store.replace(LIVE_KEY, ended, existing.etag);
  return { ok: true, session: ended, errors };
}
