import { createHash } from "node:crypto";
import { updateWithRetry, type KvStore } from "./store";
import { adjustStock, setPaused, type AdjustResult, type StockItem } from "./stock-admin";
import { parseCsv } from "../catalog-admin/csv";

/**
 * Inventory reconciliation, all of it manual and explicit:
 *
 *  1. TikTok Shop orders: upload the order export from TikTok Seller Center.
 *     Each order line is recorded ONCE as a "Sold on TikTok" stock change
 *     (claimed by order id + SKU, create-only, so re-uploading the same file
 *     or an overlapping one never double-counts). A line that later shows up
 *     canceled puts its units back once. Lines that would take stock below
 *     what website orders need are held for you to review — never forced.
 *     This is NOT live synchronization: TikTok's stock isn't changed from
 *     here, and sales only count once you upload them (the page says when
 *     you last did). No TikTok API is connected.
 *  2. Shelf counts: upload "sku,count" to set several counts at once.
 *  3. Supplier stock: record what a supplier told you (in stock, low, out,
 *     discontinued); "out" or "discontinued" pauses the item on the website.
 *
 * One authoritative stock: this site's ledger. TikTok Shop's own stock
 * number is set by you in Seller Center from the "free" count shown here.
 */

/** A stable UUID-shaped id from text, so a retried line always gets the same stock-change id. */
export function stableId(...parts: string[]): string {
  const h = createHash("sha256").update(parts.join("\u0000")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/* ------------------------------ TikTok Shop order export ------------------------------ */

export interface TikTokLine {
  line: number;
  orderId: string;
  sku: string;
  quantity: number;
  canceled: boolean;
  createdAt: string | null;
}

/**
 * Column names TikTok uses have changed over time, so several are accepted.
 * CHECK against a real export before relying on it — this was written
 * without access to a TikTok Seller Center account.
 */
export const TIKTOK_COLUMNS = {
  orderId: ["order id", "order_id", "orderid", "order number"],
  sku: ["seller sku", "seller_sku", "sku id", "sku"],
  quantity: ["quantity", "qty", "sku quantity", "item quantity"],
  status: ["order status", "order_status", "status"],
  createdAt: ["created time", "order create time", "create time", "created_at", "order created time"],
} as const;
const CANCELED = /cancel|refund|return|unpaid|failed/i;

export function parseTikTokOrders(text: string): { lines: TikTokLine[]; errors: string[]; missingColumns: string[] } {
  const rows = parseCsv(text);
  if (!rows.length) return { lines: [], errors: ["The file has no rows."], missingColumns: [] };
  const headers = Object.keys(rows[0]);
  const pick = (aliases: readonly string[]) => headers.find((h) => aliases.includes(h.trim().toLowerCase()));
  const col = { orderId: pick(TIKTOK_COLUMNS.orderId), sku: pick(TIKTOK_COLUMNS.sku), quantity: pick(TIKTOK_COLUMNS.quantity), status: pick(TIKTOK_COLUMNS.status), createdAt: pick(TIKTOK_COLUMNS.createdAt) };
  const missingColumns = (["orderId", "sku", "quantity"] as const).filter((k) => !col[k]).map((k) => TIKTOK_COLUMNS[k][0]);
  if (missingColumns.length) return { lines: [], errors: [], missingColumns };
  const lines: TikTokLine[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const orderId = (r[col.orderId!] ?? "").replace(/^'+/, "").trim();
    const sku = (r[col.sku!] ?? "").trim();
    const qty = Number((r[col.quantity!] ?? "").trim());
    if (!orderId && !sku) return; // blank/summary row
    if (!/^[\w-]{3,40}$/.test(orderId)) return void errors.push(`row ${line}: order id "${orderId.slice(0, 20)}" doesn't look right`);
    if (!sku) return void errors.push(`row ${line}: no seller SKU`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return void errors.push(`row ${line}: quantity "${r[col.quantity!]}"`);
    lines.push({ line, orderId, sku, quantity: qty, canceled: col.status ? CANCELED.test(r[col.status] ?? "") : false, createdAt: col.createdAt ? r[col.createdAt] || null : null });
  });
  // The same order + SKU twice in one file (split lines): add them up.
  const merged = new Map<string, TikTokLine>();
  for (const l of lines) {
    const k = `${l.orderId}~${l.sku}`;
    const m = merged.get(k);
    if (m) m.quantity += l.quantity;
    else merged.set(k, { ...l });
  }
  return { lines: [...merged.values()], errors, missingColumns: [] };
}

export interface TikTokRecord {
  orderId: string;
  sku: string;
  variantId: string;
  quantity: number;
  state: "sold" | "put-back";
  saleAdjustmentId: string;
  putBackAdjustmentId?: string;
  importedAt: string;
  updatedAt: string;
}

const recKey = (orderId: string, sku: string) => `reconcile/tiktok/${encodeURIComponent(orderId)}~${encodeURIComponent(sku)}`;
const LAST_KEY = "reconcile/tiktok-last";

export type PlanAction = "record-sale" | "already-recorded" | "put-back" | "already-put-back" | "canceled-not-recorded" | "unknown-sku" | "quantity-changed";
export interface PlanRow extends TikTokLine {
  action: PlanAction;
  item: (StockItem & { catalogOnHand: number | null }) | null;
}

export async function planTikTok(store: KvStore, lines: TikTokLine[], items: (StockItem & { catalogOnHand: number | null })[]): Promise<PlanRow[]> {
  const bySku = new Map(items.map((i) => [i.sku.toUpperCase(), i]));
  return Promise.all(
    lines.map(async (l): Promise<PlanRow> => {
      const item = bySku.get(l.sku.toUpperCase()) ?? null;
      if (!item) return { ...l, item, action: "unknown-sku" };
      const prev = (await store.get<TikTokRecord>(recKey(l.orderId, item.sku)))?.value;
      if (!prev) return { ...l, item, action: l.canceled ? "canceled-not-recorded" : "record-sale" };
      if (l.canceled) return { ...l, item, action: prev.state === "put-back" ? "already-put-back" : "put-back" };
      if (prev.quantity !== l.quantity) return { ...l, item, action: "quantity-changed" };
      return { ...l, item, action: prev.state === "sold" ? "already-recorded" : "already-put-back" };
    }),
  );
}

export interface ApplyOutcome {
  row: PlanRow;
  result: "applied" | "skipped" | "held";
  message?: string;
}

/** Apply a plan. Only "record-sale" and "put-back" rows change stock; each at most once, ever. */
export async function applyTikTok(store: KvStore, plan: PlanRow[], now = new Date()): Promise<ApplyOutcome[]> {
  const out: ApplyOutcome[] = [];
  for (const row of plan) {
    if (!row.item || (row.action !== "record-sale" && row.action !== "put-back")) {
      out.push({ row, result: "skipped" });
      continue;
    }
    const key = recKey(row.orderId, row.item.sku);
    if (row.action === "record-sale") {
      const saleId = stableId("tiktok-sale", row.orderId, row.item.sku);
      const rec: TikTokRecord = { orderId: row.orderId, sku: row.item.sku, variantId: row.item.variantId, quantity: row.quantity, state: "sold", saleAdjustmentId: saleId, importedAt: now.toISOString(), updatedAt: now.toISOString() };
      if (!(await store.create(key, rec))) {
        out.push({ row, result: "skipped", message: "already recorded (another upload got there first)" });
        continue;
      }
      const r: AdjustResult = await adjustStock(store, { variantId: row.item.variantId, sku: row.item.sku, kind: "tiktok-sale", quantity: row.quantity, note: `TikTok Shop order ${row.orderId}`, requestId: saleId, catalogOnHand: row.item.catalogOnHand }, now);
      if (!r.ok) {
        await store.delete(key); // not counted: a later upload (or you, after checking the shelf) can record it
        out.push({ row, result: "held", message: r.error });
      } else out.push({ row, result: r.duplicate ? "skipped" : "applied" });
    } else {
      const backId = stableId("tiktok-put-back", row.orderId, row.item.sku);
      let claimed = false;
      await updateWithRetry<TikTokRecord>(store, key, (cur) => {
        if (!cur || cur.state !== "sold") return undefined;
        claimed = true;
        return { ...cur, state: "put-back", putBackAdjustmentId: backId, updatedAt: now.toISOString() };
      });
      if (!claimed) {
        out.push({ row, result: "skipped" });
        continue;
      }
      const r = await adjustStock(store, { variantId: row.item.variantId, sku: row.item.sku, kind: "returned", quantity: row.quantity, note: `TikTok Shop order ${row.orderId} canceled`, requestId: backId, catalogOnHand: row.item.catalogOnHand }, now);
      out.push(r.ok ? { row, result: "applied" } : { row, result: "held", message: r.error });
    }
  }
  const applied = out.filter((o) => o.result === "applied").length;
  const cur = await store.get<{ at: string }>(LAST_KEY);
  const val = { at: now.toISOString(), rows: plan.length, applied, held: out.filter((o) => o.result === "held").length };
  if (cur) await store.replace(LAST_KEY, val, cur.etag);
  else await store.create(LAST_KEY, val);
  return out;
}

export async function lastTikTokReconcile(store: KvStore): Promise<{ at: string; rows: number; applied: number; held: number } | null> {
  return (await store.get<{ at: string; rows: number; applied: number; held: number }>(LAST_KEY))?.value ?? null;
}

/* ------------------------------ shelf counts ------------------------------ */

export function parseCounts(text: string): { rows: { line: number; sku: string; count: number; note: string | null }[]; errors: string[] } {
  const rows = parseCsv(text);
  const out: { line: number; sku: string; count: number; note: string | null }[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const sku = (r.sku ?? r.SKU ?? "").trim();
    const raw = (r.count ?? r.Count ?? r.on_hand ?? "").trim();
    if (!sku && !raw) return;
    const n = Number(raw);
    if (!sku || !/^\d+$/.test(raw) || n > 10_000) errors.push(`row ${i + 2}: needs a SKU and a whole-number count`);
    else out.push({ line: i + 2, sku, count: n, note: (r.note ?? "").trim().slice(0, 200) || null });
  });
  return { rows: out, errors };
}

/* ------------------------------ supplier stock ------------------------------ */

export const SUPPLIER_STOCK = { "in-stock": "In stock", low: "Running low", out: "Out of stock", discontinued: "Discontinued", unknown: "Unknown" } as const;
export type SupplierStockState = keyof typeof SUPPLIER_STOCK;
export interface SupplierStock {
  variantId: string;
  state: SupplierStockState;
  quantity: number | null;
  checkedAt: string;
  note: string | null;
}
export const SUPPLIER_STOCK_STALE_DAYS = 7;
const ssKey = (variantId: string) => `supplier-stock/${variantId}`;

export async function getSupplierStock(store: KvStore, variantId: string): Promise<SupplierStock | null> {
  return (await store.get<SupplierStock>(ssKey(variantId)))?.value ?? null;
}

/** Record what the supplier told you. Out or discontinued also pauses the item on the website. */
export async function setSupplierStock(store: KvStore, input: Omit<SupplierStock, "checkedAt">, now = new Date()): Promise<{ paused: boolean }> {
  const val: SupplierStock = { ...input, checkedAt: now.toISOString() };
  await updateWithRetry<SupplierStock>(store, ssKey(input.variantId), () => val);
  if (input.state === "out" || input.state === "discontinued") {
    await setPaused(store, [input.variantId], true, `Supplier: ${SUPPLIER_STOCK[input.state].toLowerCase()}`, "owner", now);
    return { paused: true };
  }
  return { paused: false };
}

export const supplierStockStale = (s: SupplierStock | null, now = new Date()) => !s || now.getTime() - Date.parse(s.checkedAt) > SUPPLIER_STOCK_STALE_DAYS * 86_400_000;
