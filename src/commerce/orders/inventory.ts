import { updateWithRetry, type KvStore } from "./store";

/**
 * Overselling protection — and the single source of truth for stock.
 *
 * One record per variant (`stock/<variantId>`) holds everything that decides
 * whether a unit can be sold, so one compare-and-set write can check and
 * change it atomically:
 *  - `onHand`: units you physically have (or a supplier has confirmed) that
 *    aren't promised to a TikTok buyer. Set and changed by the owner on the
 *    inventory page (stock arrived, TikTok sale, damaged, count…) and reduced
 *    automatically when a website package ships. Until the owner first touches
 *    a variant, it's the catalog's count.
 *  - `entries`: website checkouts holding units ("held") or paid and waiting to
 *    ship ("sold").
 *  - `paused`: website purchasing paused (e.g. during a TikTok LIVE).
 *   available on the website = onHand − sold − (holds that haven't expired)
 * See docs/INVENTORY.md.
 *
 * - reserve():  before a Stripe Checkout Session is created. All-or-nothing.
 * - commit():   when payment is verified. Idempotent: running it twice (or
 *               concurrently) never counts a sale twice.
 * - release():  when the session expires or payment fails. Idempotent.
 * Holds expire on their own at the session's expires_at, so a crash can
 * never lock stock forever.
 *
 * Every write is compare-and-set (see store.ts), so two shoppers racing for
 * the last unit can't both get it.
 */

export interface LedgerEntry {
  quantity: number;
  expiresAt: number;
  state: "held" | "sold";
}

export interface VariantLedger {
  variantId: string;
  entries: Record<string, LedgerEntry>;
  /** Owner-managed physical count. Missing = never changed here, so the catalog's count applies. */
  onHand?: number;
  /** Website packages already taken off `onHand` when they shipped (idempotency; pruned after 180 days). */
  shipped?: Record<string, { units: number; at: string }>;
  /** Website purchasing paused for this variant. */
  paused?: { at: string; reason: string; by: "owner" | "live" } | null;
  /** The owner marked this variant as listed on TikTok Shop (sold from the same shelf). */
  tiktokListed?: boolean;
  /** Last physical count. */
  lastCountedAt?: string | null;
  /** Most recent changes to this variant, newest first (the full log is in the activity log). */
  recent?: import("./stock-admin").InventoryAdjustment[];
}

export interface ReservationRecord {
  checkoutId: string;
  lines: { variantId: string; quantity: number }[];
  expiresAt: number;
  status: "held" | "committed" | "released";
}

const ledgerKey = (variantId: string) => `stock/${variantId}`;
const reservationKey = (checkoutId: string) => `reservation/${checkoutId}`;

/** The count that applies: the owner's managed count once it exists, otherwise the catalog's. */
export function effectiveOnHand(ledger: VariantLedger | null, catalogOnHand: number | null): number | null {
  return typeof ledger?.onHand === "number" ? ledger.onHand : catalogOnHand;
}

/** Units sold on the website and not shipped yet (still on the shelf, but promised). */
export function soldUnits(ledger: VariantLedger | null): number {
  return Object.values(ledger?.entries ?? {}).reduce((n, e) => n + (e.state === "sold" ? e.quantity : 0), 0);
}

/** Units in shoppers' open checkouts right now. */
export function heldUnits(ledger: VariantLedger | null, now: number): number {
  return Object.values(ledger?.entries ?? {}).reduce((n, e) => n + (e.state === "held" && e.expiresAt > now ? e.quantity : 0), 0);
}

/**
 * Units the website can still sell. `onHand` is the catalog's count; the
 * owner-managed count in the ledger takes over once it exists.
 */
export function availableUnits(onHand: number, ledger: VariantLedger | null, now: number, excludeCheckoutId?: string): number {
  const base = effectiveOnHand(ledger, onHand) ?? 0;
  let used = 0;
  for (const [id, entry] of Object.entries(ledger?.entries ?? {})) {
    if (id === excludeCheckoutId) continue;
    if (entry.state === "sold" || entry.expiresAt > now) used += entry.quantity;
  }
  return Math.max(0, base - used);
}

function pruneExpired(ledger: VariantLedger, now: number) {
  for (const [id, entry] of Object.entries(ledger.entries)) {
    if (entry.state === "held" && entry.expiresAt <= now) delete ledger.entries[id];
  }
}

export type ReserveResult = { ok: true } | { ok: false; variantId: string; available: number; paused?: true };

export async function reserveStock(
  store: KvStore,
  checkoutId: string,
  lines: { variantId: string; quantity: number; onHand: number }[],
  expiresAt: number,
  now: number,
): Promise<ReserveResult> {
  const placed: string[] = [];
  const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const line of sorted) {
    let shortBy: number | null = null;
    let paused = false;
    await updateWithRetry<VariantLedger>(store, ledgerKey(line.variantId), (current) => {
      const ledger = current ?? { variantId: line.variantId, entries: {} };
      // Paused on the website (e.g. selling it on TikTok LIVE right now): nothing can be held.
      if (ledger.paused) {
        paused = true;
        shortBy = 0;
        return undefined;
      }
      pruneExpired(ledger, now);
      const available = availableUnits(line.onHand, ledger, now, checkoutId);
      if (line.quantity > available) {
        shortBy = available;
        return undefined;
      }
      shortBy = null;
      ledger.entries[checkoutId] = { quantity: line.quantity, expiresAt, state: "held" };
      return ledger;
    });
    if (shortBy !== null) {
      await releaseHolds(store, checkoutId, placed);
      return paused ? { ok: false, variantId: line.variantId, available: 0, paused: true } : { ok: false, variantId: line.variantId, available: shortBy };
    }
    placed.push(line.variantId);
  }
  await store.create<ReservationRecord>(reservationKey(checkoutId), {
    checkoutId,
    lines: sorted.map(({ variantId, quantity }) => ({ variantId, quantity })),
    expiresAt,
    status: "held",
  });
  return { ok: true };
}

async function releaseHolds(store: KvStore, checkoutId: string, variantIds: string[]) {
  for (const variantId of variantIds) {
    await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
      const entry = current?.entries[checkoutId];
      if (!current || !entry || entry.state !== "held") return undefined;
      delete current.entries[checkoutId];
      return current;
    });
  }
}

/** Free the stock held by an expired / failed / abandoned checkout. Safe to repeat. */
export async function releaseStock(store: KvStore, checkoutId: string): Promise<void> {
  const reservation = await store.get<ReservationRecord>(reservationKey(checkoutId));
  if (!reservation || reservation.value.status !== "held") return;
  await releaseHolds(store, checkoutId, reservation.value.lines.map((l) => l.variantId));
  await updateWithRetry<ReservationRecord>(store, reservationKey(checkoutId), (current) =>
    current && current.status === "held" ? { ...current, status: "released" } : undefined,
  );
}

/**
 * Turn a checkout's holds into sales. Safe to call repeatedly/concurrently.
 * Returns `oversold: true` if a hold had already expired and the units were
 * sold to someone else in the meantime — or the owner's count dropped below
 * what the website has sold (e.g. a TikTok sale recorded during checkout) —
 * so the order needs manual review (contact the customer / refund) instead of
 * being shipped automatically.
 */
export async function commitStock(
  store: KvStore,
  checkoutId: string,
  lines: { variantId: string; quantity: number; onHand: number }[],
  now: number,
): Promise<{ oversold: boolean }> {
  let oversold = false;
  for (const line of lines) {
    await updateWithRetry<VariantLedger>(store, ledgerKey(line.variantId), (current) => {
      const ledger = current ?? { variantId: line.variantId, entries: {} };
      const entry = ledger.entries[checkoutId];
      if (entry?.state === "sold") return undefined; // already committed
      const stillHeld = entry?.state === "held" && entry.expiresAt > now;
      if (!stillHeld && availableUnits(line.onHand, ledger, now, checkoutId) < line.quantity) oversold = true;
      ledger.entries[checkoutId] = { quantity: line.quantity, expiresAt: entry?.expiresAt ?? now, state: "sold" };
      // Even a valid hold can't be filled if the shelf now has fewer units than the website has sold.
      if (soldUnits(ledger) > (effectiveOnHand(ledger, line.onHand) ?? 0)) oversold = true;
      return ledger;
    });
  }
  await updateWithRetry<ReservationRecord>(store, reservationKey(checkoutId), (current) =>
    current && current.status !== "committed" ? { ...current, status: "committed" } : undefined,
  );
  return { oversold };
}

export async function getReservation(store: KvStore, checkoutId: string) {
  return (await store.get<ReservationRecord>(reservationKey(checkoutId)))?.value ?? null;
}

/**
 * Owner canceled an order before it shipped: the units are still on the
 * shelf, so remove this checkout's "sold" entries. Safe to repeat.
 */
export async function unsellStock(store: KvStore, checkoutId: string, variantIds: string[]): Promise<void> {
  for (const variantId of new Set(variantIds)) {
    await updateWithRetry<VariantLedger>(store, ledgerKey(variantId), (current) => {
      if (!current?.entries[checkoutId] || current.entries[checkoutId].state !== "sold") return undefined;
      delete current.entries[checkoutId];
      return current;
    });
  }
}

/**
 * A website package shipped: its units leave the shelf. Takes them off the
 * managed count and out of "sold, waiting to ship" in one write per variant.
 * Idempotent per package shipment (`shipmentKey`), so pressing "Mark shipped"
 * again, or updating the tracking number, never deducts twice. A replacement
 * shipment has its own key (the original units were already deducted).
 * Returns the shortfall if the count was lower than what shipped (the count
 * was wrong) — the count is then set to 0 and the owner is told.
 */
export async function deductShippedStock<A>(
  store: KvStore,
  checkoutId: string,
  shipmentKey: string,
  lines: { variantId: string; sku: string; quantity: number; onHand: number | null }[],
  /** Builds the log entry for this write and stores it on the record (same write, so it's atomic). */
  record: (ledger: VariantLedger, line: { variantId: string; sku: string; quantity: number }, before: number, after: number) => A,
  now: Date,
): Promise<{ shortfall: { variantId: string; units: number }[]; applied: A[] }> {
  const shortfall: { variantId: string; units: number }[] = [];
  const applied: A[] = [];
  const cutoff = now.getTime() - 180 * 86_400_000;
  for (const line of lines) {
    let attempt: { entry: A; short: number } | null = null;
    const { changed } = await updateWithRetry<VariantLedger>(store, ledgerKey(line.variantId), (current) => {
      attempt = null;
      const ledger = current ?? { variantId: line.variantId, entries: {} };
      ledger.shipped ??= {};
      if (ledger.shipped[shipmentKey]) return undefined; // already deducted
      for (const [k, v] of Object.entries(ledger.shipped)) if (Date.parse(v.at) < cutoff) delete ledger.shipped[k];
      const before = effectiveOnHand(ledger, line.onHand) ?? 0;
      const after = Math.max(0, before - line.quantity);
      ledger.onHand = after;
      const entry = ledger.entries[checkoutId];
      if (entry?.state === "sold") {
        const left = entry.quantity - line.quantity;
        if (left > 0) entry.quantity = left;
        else delete ledger.entries[checkoutId];
      }
      ledger.shipped[shipmentKey] = { units: line.quantity, at: now.toISOString() };
      attempt = { entry: record(ledger, line, before, after), short: Math.max(0, line.quantity - before) };
      return ledger;
    });
    // Only the attempt that was actually saved counts (a retried attempt is discarded).
    const saved = attempt as { entry: A; short: number } | null;
    if (changed && saved) {
      applied.push(saved.entry);
      if (saved.short) shortfall.push({ variantId: line.variantId, units: saved.short });
    }
  }
  return { shortfall, applied };
}

export async function getLedger(store: KvStore, variantId: string): Promise<VariantLedger | null> {
  return (await store.get<VariantLedger>(ledgerKey(variantId)))?.value ?? null;
}

export { ledgerKey };
