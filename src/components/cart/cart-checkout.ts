import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * Cart bookkeeping around a Stripe Checkout, kept free of React so it can be tested.
 *
 * When checkout starts, the browser remembers which cart lines went to which
 * checkout (`<cart key>:pending-checkout`). Only the result page, after the
 * server has re-fetched the session from Stripe and confirmed it is PAID,
 * removes exactly those lines. Canceled, failed, still-processing or
 * unverifiable checkouts leave the cart alone, and so does opening a
 * confirmation link in a browser that didn't start that checkout.
 */

/** localStorage keys: the Stripe TEST cart is kept apart so test fixtures never reach a shopper's cart. */
export const CART_STORAGE_KEY = "funksquish-cart-v1";
export const TEST_CART_STORAGE_KEY = "funksquish-stripe-test-cart-v1";

export type PaidLine = { variantId: string; quantity: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PendingCheckout = { checkoutId: string; lines: PaidLine[] };

export const pendingCheckoutKey = (cartKey: string) => `${cartKey}:pending-checkout`;

const UUID = /^[0-9a-f-]{36}$/;

export function rememberPendingCheckout(storage: StorageLike, cartKey: string, checkoutId: string, lines: PaidLine[]): void {
  if (!UUID.test(checkoutId)) return;
  try {
    const pending: PendingCheckout = { checkoutId, lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) };
    storage.setItem(pendingCheckoutKey(cartKey), JSON.stringify(pending));
  } catch {
    /* storage unavailable: the cart simply isn't cleared automatically */
  }
}

function readPending(storage: StorageLike, cartKey: string): PendingCheckout | null {
  try {
    const raw = JSON.parse(storage.getItem(pendingCheckoutKey(cartKey)) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return null;
    const { checkoutId, lines } = raw as { checkoutId?: unknown; lines?: unknown };
    if (typeof checkoutId !== "string" || !Array.isArray(lines)) return null;
    const valid = lines.filter(
      (l): l is PaidLine => !!l && typeof l.variantId === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
    );
    return { checkoutId, lines: valid };
  } catch {
    return null;
  }
}

/** The cart minus what was paid for. Lines added after checkout started stay. */
export function removePaidLines<L extends PaidLine>(cart: L[], paid: PaidLine[]): L[] {
  const bought = new Map<string, number>();
  for (const p of paid) bought.set(p.variantId, (bought.get(p.variantId) ?? 0) + p.quantity);
  return cart.flatMap((l) => {
    const left = l.quantity - (bought.get(l.variantId) ?? 0);
    return left > 0 ? [{ ...l, quantity: left }] : [];
  });
}

/**
 * Call only for a checkout the server verified as paid. Returns the new cart
 * lines, or null when this browser didn't start that checkout (nothing changes).
 * Runs once per checkout: the marker is removed, so a reload can't remove more.
 */
export function clearPaidCheckout<L extends PaidLine>(storage: StorageLike, cartKey: string, checkoutId: string, cart: L[]): L[] | null {
  const pending = readPending(storage, cartKey);
  if (!pending || !checkoutId || pending.checkoutId !== checkoutId) return null;
  const next = removePaidLines(cart, pending.lines);
  try {
    storage.setItem(cartKey, JSON.stringify(next));
    storage.removeItem(pendingCheckoutKey(cartKey));
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
