import { updateWithRetry, type KvStore } from "./store";

/**
 * Overselling protection.
 *
 * On-hand stock comes from the catalog (what's physically on the shelf or
 * confirmed with a supplier). This ledger records, per variant, every
 * checkout that is holding or has bought units:
 *   available = onHand − sold − (holds that haven't expired)
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
}

export interface ReservationRecord {
  checkoutId: string;
  lines: { variantId: string; quantity: number }[];
  expiresAt: number;
  status: "held" | "committed" | "released";
}

const ledgerKey = (variantId: string) => `stock/${variantId}`;
const reservationKey = (checkoutId: string) => `reservation/${checkoutId}`;

export function availableUnits(onHand: number, ledger: VariantLedger | null, now: number, excludeCheckoutId?: string): number {
  let used = 0;
  for (const [id, entry] of Object.entries(ledger?.entries ?? {})) {
    if (id === excludeCheckoutId) continue;
    if (entry.state === "sold" || entry.expiresAt > now) used += entry.quantity;
  }
  return Math.max(0, onHand - used);
}

function pruneExpired(ledger: VariantLedger, now: number) {
  for (const [id, entry] of Object.entries(ledger.entries)) {
    if (entry.state === "held" && entry.expiresAt <= now) delete ledger.entries[id];
  }
}

export type ReserveResult = { ok: true } | { ok: false; variantId: string; available: number };

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
    await updateWithRetry<VariantLedger>(store, ledgerKey(line.variantId), (current) => {
      const ledger = current ?? { variantId: line.variantId, entries: {} };
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
      return { ok: false, variantId: line.variantId, available: shortBy };
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
 * sold to someone else in the meantime — the order then needs manual review
 * (contact the customer / refund) instead of being shipped automatically.
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
