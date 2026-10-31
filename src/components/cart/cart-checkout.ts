import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * Cart bookkeeping around Stripe Checkout, kept free of React so it can be tested.
 *
 * Starting checkout records, per checkout id, how many units of each item went
 * to that checkout (`<cart key>:pending-checkouts`). Only the result page, after
 * the server re-fetched the session from Stripe and confirmed it PAID, removes
 * that checkout's units — and only units that are still in the cart from before
 * it started. Canceled, failed, still-processing or unverifiable checkouts leave
 * the cart alone, as does opening a confirmation link in a browser that didn't
 * start that checkout.
 *
 * Several checkouts can be pending at once (start one, go Back, start another).
 * Each record's per-item count only ever goes down: every cart change lowers it
 * to what's still in the cart. So units added after a checkout started are never
 * removed, and two paid checkouts for the same units can't remove them twice,
 * whichever confirmation arrives first. Records are bounded (newest 10, 24 hours;
 * Checkout sessions here expire long before that).
 */

/** localStorage keys: the Stripe TEST cart is kept apart so test fixtures never reach a shopper's cart. */
export const CART_STORAGE_KEY = "funksquish-cart-v1";
export const TEST_CART_STORAGE_KEY = "funksquish-stripe-test-cart-v1";

export type PaidLine = { variantId: string; quantity: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** `units`: this checkout's units of each item that are still in the cart (never goes up). */
type PendingCheckout = { units: Record<string, number>; startedAt: number };
type PendingCheckouts = Record<string, PendingCheckout>;

export const pendingCheckoutsKey = (cartKey: string) => `${cartKey}:pending-checkouts`;
export const MAX_PENDING_CHECKOUTS = 10;
export const PENDING_CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f-]{36}$/;
const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1000;

/** Damaged or foreign data is dropped; expired records are forgotten. Never throws. */
function readPending(storage: StorageLike, cartKey: string, now: number): PendingCheckouts {
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(pendingCheckoutsKey(cartKey)) ?? "{}");
  } catch {
    return {};
  }
  const out: PendingCheckouts = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (!UUID.test(id) || !rec || typeof rec !== "object") continue;
    const { units, startedAt } = rec as { units?: unknown; startedAt?: unknown };
    if (typeof startedAt !== "number" || now - startedAt > PENDING_CHECKOUT_TTL_MS || startedAt > now + 60_000) continue;
    if (!units || typeof units !== "object" || Array.isArray(units)) continue;
    const clean = Object.fromEntries(Object.entries(units as Record<string, unknown>).filter(([, n]) => isCount(n))) as Record<string, number>;
    out[id] = { units: clean, startedAt };
  }
  return out;
}

/** Keeps the newest records only. Throws if storage is unavailable (callers catch). */
function writePending(storage: StorageLike, cartKey: string, pending: PendingCheckouts) {
  const newest = Object.entries(pending)
    .sort(([, a], [, b]) => b.startedAt - a.startedAt)
    .slice(0, MAX_PENDING_CHECKOUTS);
  if (newest.length === 0) storage.removeItem(pendingCheckoutsKey(cartKey));
  else storage.setItem(pendingCheckoutsKey(cartKey), JSON.stringify(Object.fromEntries(newest)));
}

const quantities = (cart: PaidLine[]) => {
  const q = new Map<string, number>();
  for (const l of cart) q.set(l.variantId, (q.get(l.variantId) ?? 0) + l.quantity);
  return q;
};

/** Lowers every pending checkout's counts to what's in the cart now. */
function lowerTo(pending: PendingCheckouts, cart: PaidLine[]) {
  const inCart = quantities(cart);
  for (const rec of Object.values(pending))
    for (const v of Object.keys(rec.units)) rec.units[v] = Math.min(rec.units[v], inCart.get(v) ?? 0);
}

export function rememberPendingCheckout(storage: StorageLike, cartKey: string, checkoutId: string, lines: PaidLine[], now = Date.now()): void {
  if (!UUID.test(checkoutId)) return;
  try {
    const pending = readPending(storage, cartKey, now);
    pending[checkoutId] = { units: Object.fromEntries(quantities(lines)), startedAt: now };
    writePending(storage, cartKey, pending);
  } catch {
    /* storage unavailable: the cart simply isn't cleared automatically */
  }
}

/** Call after every cart change (add, remove, quantity), with the new cart. */
export function trackCartChange(storage: StorageLike, cartKey: string, cart: PaidLine[], now = Date.now()): void {
  try {
    if (storage.getItem(pendingCheckoutsKey(cartKey)) === null) return; // nothing pending
    const pending = readPending(storage, cartKey, now); // also drops expired or damaged records
    lowerTo(pending, cart);
    writePending(storage, cartKey, pending);
  } catch {
    /* storage unavailable */
  }
}

/** The cart minus the paid units of each item (never below zero). */
export function removePaidLines<L extends PaidLine>(cart: L[], paid: PaidLine[]): L[] {
  const bought = quantities(paid);
  return cart.flatMap((l) => {
    const take = Math.min(l.quantity, bought.get(l.variantId) ?? 0);
    bought.set(l.variantId, (bought.get(l.variantId) ?? 0) - take);
    const left = l.quantity - take;
    return left > 0 ? [{ ...l, quantity: left }] : [];
  });
}

/**
 * Call only for a checkout the server verified as paid. Returns the new cart
 * lines, or null when this browser has no record of that checkout (nothing
 * changes). Runs once per checkout: its record is removed, so a reload can't
 * remove more, and the other pending records are lowered to the new cart.
 */
export function clearPaidCheckout<L extends PaidLine>(storage: StorageLike, cartKey: string, checkoutId: string, cart: L[], now = Date.now()): L[] | null {
  const pending = readPending(storage, cartKey, now);
  const rec = checkoutId ? pending[checkoutId] : undefined;
  if (!rec) return null;
  const next = removePaidLines(
    cart,
    Object.entries(rec.units).map(([variantId, quantity]) => ({ variantId, quantity })),
  );
  delete pending[checkoutId];
  lowerTo(pending, next);
  try {
    storage.setItem(cartKey, JSON.stringify(next));
    writePending(storage, cartKey, pending);
  } catch {
    /* storage unavailable */
  }
  return next;
}

/** The site was redeployed while this page was open: its server-action IDs no longer exist. */
export function isStaleDeployError(err: unknown): boolean {
  return unstable_isUnrecognizedActionError(err) || (err instanceof Error && err.name === "UnrecognizedActionError");
}

export type CheckoutProblem = { message: string; reload: boolean };

/** What to tell the shopper when starting checkout threw (rather than returning an error). */
export function checkoutStartProblem(err: unknown): CheckoutProblem {
  if (isStaleDeployError(err))
    return {
      message: "This page is out of date because the shop was just updated. Nothing was charged and your cart is saved. Reload the page to continue.",
      reload: true,
    };
  return {
    message: "We couldn't reach secure checkout just now. Nothing was charged and your cart is saved. Please try again in a moment.",
    reload: false,
  };
}
