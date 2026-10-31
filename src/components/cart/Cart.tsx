"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Money } from "@/commerce/types";
import { formatMoney } from "@/commerce/availability";
import { quoteCheckout, startCheckout } from "@/app/actions/checkout";
import type { CartQuote } from "@/commerce/checkout/service";
import { CloseIcon, LockIcon } from "@/components/icons/Icons";
import {
  CART_STORAGE_KEY,
  checkoutStartProblem,
  clearPaidCheckout,
  isStaleDeployError,
  rememberPendingCheckout,
  type CheckoutProblem,
} from "./cart-checkout";

/**
 * Cart — PREPARED, NOT RENDERED during pre-launch.
 *
 * Only mounted when `features.commerce` is on and `features.checkoutMode`
 * is "hosted-checkout" (see SiteHeader). Stores product references only
 * (no personal data) in localStorage so the cart survives a page reload.
 * Prices shown here are display copies; the hosted checkout is authoritative.
 */

export interface CartLine {
  variantId: string;
  productName: string;
  variantName: string;
  price: Money | null;
  quantity: number;
}

const DEFAULT_KEY = CART_STORAGE_KEY;
let storageKey = DEFAULT_KEY;
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

const MAX_QTY = 10;
const clampQty = (n: unknown) => (typeof n === "number" && Number.isInteger(n) ? Math.max(1, Math.min(MAX_QTY, n)) : 1);

/** Stored data is untrusted (old versions, manual edits): keep only well-formed lines. */
function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const l of raw.slice(0, 20)) {
    if (!l || typeof l !== "object" || typeof l.variantId !== "string" || seen.has(l.variantId)) continue;
    seen.add(l.variantId);
    const price = l.price && Number.isInteger(l.price.amount) && l.price.currency === "USD" ? (l.price as Money) : null;
    out.push({
      variantId: l.variantId,
      productName: typeof l.productName === "string" ? l.productName : "Item",
      variantName: typeof l.variantName === "string" ? l.variantName : "",
      price,
      quantity: clampQty(l.quantity),
    });
  }
  return out;
}

function load() {
  try {
    lines = sanitize(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    lines = [];
  }
}
function save(next: CartLine[]) {
  lines = next;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    /* storage unavailable: cart still works for this visit */
  }
  listeners.forEach((l) => l());
}
// Another tab changed the cart (e.g. its order was just paid): pick that up so this tab can't save the old cart back.
const onStorage = (e: StorageEvent) => {
  if (e.key !== storageKey) return;
  load();
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
};

/**
 * Removes what was paid for from this browser's cart. Call ONLY after the server
 * verified the checkout as paid. No-op unless this browser started that checkout.
 */
export function clearCartAfterPaidCheckout(key: string, checkoutId: string): void {
  try {
    const stored = key === storageKey && loaded ? lines : sanitize(JSON.parse(localStorage.getItem(key) ?? "[]"));
    const next = clearPaidCheckout(localStorage, key, checkoutId, stored);
    if (next && key === storageKey && loaded) {
      lines = next;
      listeners.forEach((l) => l());
    }
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
const EMPTY: CartLine[] = [];

interface CartApi {
  lines: CartLine[];
  count: number;
  add(line: Omit<CartLine, "quantity">, quantity?: number): void;
  setQuantity(variantId: string, quantity: number): void;
  remove(variantId: string): void;
  open: boolean;
  setOpen(open: boolean): void;
}

const CartContext = createContext<CartApi | null>(null);

export function useCart() {
  return useContext(CartContext);
}

/**
 * `storageKey` keeps the Stripe TEST cart separate from the real one, so test
 * fixtures can never end up in a shopper's cart.
 */
export function CartProvider({ children, storageKey: key = DEFAULT_KEY }: { children: ReactNode; storageKey?: string }) {
  const [open, setOpen] = useState(false);
  const current = useSyncExternalStore(
    subscribe,
    () => {
      if (!loaded || storageKey !== key) {
        storageKey = key;
        load();
        loaded = true;
      }
      return lines;
    },
    () => EMPTY,
  );

  const api: CartApi = {
    lines: current,
    count: current.reduce((n, l) => n + l.quantity, 0),
    add(line, quantity = 1) {
      const existing = lines.find((l) => l.variantId === line.variantId);
      save(
        existing
          ? lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity: clampQty(l.quantity + quantity) } : l))
          : [...lines, { ...line, quantity: clampQty(quantity) }],
      );
      setOpen(true);
    },
    setQuantity(variantId, quantity) {
      if (!Number.isFinite(quantity)) return; // e.g. the box was cleared while typing
      save(lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQty(Math.round(quantity)) } : l)));
    },
    remove(variantId) {
      save(lines.filter((l) => l.variantId !== variantId));
    },
    open,
    setOpen,
  };

  return (
    <CartContext.Provider value={api}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

function CartDrawer() {
  const cart = useCart()!;
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<CheckoutProblem | null>(null);
  // Blocks a second start (double click) before React re-renders the disabled button.
  const starting = useRef(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const cartKey = cart.lines.map((l) => `${l.variantId}:${l.quantity}`).join("|");

  // Shipping is calculated on the server from the cart (same calculation as checkout),
  // so the shopper sees the combined shipping charge before leaving for payment.
  useEffect(() => {
    if (!cart.open || cart.lines.length === 0) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const q = await quoteCheckout(cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })));
        if (!stale) setQuote(q);
      } catch (err) {
        if (stale) return;
        setQuote(null);
        // The shop was redeployed while this page was open: say so now, before the shopper presses checkout.
        if (isStaleDeployError(err)) setError(checkoutStartProblem(err));
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartKey captures the lines
  }, [cart.open, cartKey]);
  const blocked = quote && !quote.ok ? new Map(quote.blocked.map((b) => [b.variantId, b.message])) : new Map<string, string>();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (cart.open && !d.open) d.showModal();
    if (!cart.open && d.open) d.close();
  }, [cart.open]);

  const subtotal = cart.lines.every((l) => l.price)
    ? { amount: cart.lines.reduce((s, l) => s + (l.price?.amount ?? 0) * l.quantity, 0), currency: "USD" as const }
    : null;

  // Coming back from Stripe with the browser's Back button restores this page from cache,
  // still showing "Opening secure checkout…": make the button usable again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      starting.current = false;
      setPending(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  async function checkout() {
    if (starting.current) return;
    starting.current = true;
    setPending(true);
    setError(null);
    const sent = cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
    try {
      const result = await startCheckout(sent);
      if (result.ok) {
        rememberPendingCheckout(localStorage, storageKey, result.checkoutId, sent);
        window.location.assign(result.url);
        return; // stays "Opening secure checkout…" while the browser leaves
      }
      setError({ message: result.error, reload: false });
    } catch (err) {
      // Thrown, not returned: the page is from an older deploy, or the network dropped. Never leave the button stuck.
      setError(checkoutStartProblem(err));
    }
    starting.current = false;
    setPending(false);
  }

  return (
    <dialog
      ref={dialog}
      onClose={() => cart.setOpen(false)}
      aria-labelledby="cart-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-sky-200 p-5">
          <h2 id="cart-title" className="font-display text-2xl font-bold">
            Your cart
          </h2>
          <button type="button" onClick={() => cart.setOpen(false)} className="grid size-11 place-items-center rounded-full hover:bg-ice">
            <CloseIcon className="size-5" />
            <span className="sr-only">Close cart</span>
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <p className="p-5 text-ink-soft">Your cart is empty.</p>
        ) : (
          <ul className="flex-1 space-y-3 overflow-y-auto p-5">
            {cart.lines.map((l) => (
              <li key={l.variantId} className="rounded-2xl bg-ice-50 p-4 ring-1 ring-inset ring-sky-200">
                <p className="font-display font-semibold">{l.productName}</p>
                <p className="text-sm text-ink-soft">{l.variantName}</p>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    Qty
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={l.quantity}
                      onChange={(e) => cart.setQuantity(l.variantId, Number(e.target.value))}
                      className="w-16 rounded-full bg-white px-3 py-1.5 ring-1 ring-inset ring-sky-200"
                    />
                  </label>
                  <span className="font-display font-semibold">{formatMoney(l.price)}</span>
                </div>
                {blocked.get(l.variantId) && (
                  <p role="alert" className="mt-2 rounded-xl bg-berry-soft px-3 py-2 text-sm text-ink">
                    {blocked.get(l.variantId)}
                  </p>
                )}
                <button type="button" onClick={() => cart.remove(l.variantId)} className="mt-2 text-sm font-semibold text-royal underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-sky-200 p-5">
          <p className="flex justify-between font-display text-lg font-bold">
            Subtotal <span>{formatMoney(subtotal)}</span>
          </p>
          {quote?.ok ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex justify-between font-semibold">
                Shipping{quote.packages.length > 1 ? ` (${quote.packages.length} packages)` : ""} <span>{formatMoney({ amount: quote.shipping, currency: "USD" })}</span>
              </p>
              {quote.packages.length > 1 && (
                <ul className="space-y-0.5 text-ink-soft">
                  {quote.packages.map((p, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        From {p.label}: {p.units} item{p.units === 1 ? "" : "s"}, ships within {p.shipsWithinBusinessDays} business day{p.shipsWithinBusinessDays === 1 ? "" : "s"}
                      </span>
                      <span>{formatMoney({ amount: p.cents, currency: "USD" })}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex justify-between font-display text-base font-bold">
                Total before tax <span>{formatMoney({ amount: quote.totalBeforeTax, currency: "USD" })}</span>
              </p>
              <p className="text-ink-soft">
                {quote.packages.length > 1 ? "Items from different places ship separately, each with its own tracking. " : ""}
                Any sales tax is added on the secure checkout page, which shows your final total before you pay. No shipping is ever added later.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">{quote && !quote.ok && quote.blocked.length === 0 ? quote.error : "Shipping is calculated for your cart before you pay; tax is shown on the secure checkout page."}</p>
          )}
          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-berry-soft px-3 py-2 text-sm text-ink">
              <p>{error.message}</p>
              {error.reload && (
                <button type="button" onClick={() => window.location.reload()} className="mt-2 font-semibold text-royal underline">
                  Reload page
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={checkout}
            disabled={pending || cart.lines.length === 0 || blocked.size > 0 || !!error?.reload}
            className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-royal font-display text-lg font-semibold text-white shadow-[0_6px_0_var(--color-navy)] disabled:opacity-60"
          >
            <LockIcon className="size-5" />
            {pending ? "Opening secure checkout…" : "Secure checkout"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Header cart button (only rendered when the cart is enabled). */
export function CartButton() {
  const cart = useCart();
  if (!cart) return null;
  return (
    <button
      type="button"
      onClick={() => cart.setOpen(true)}
      className="relative inline-flex size-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-inset ring-sky-200"
    >
      <span className="sr-only">Open cart ({cart.count} items)</span>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {cart.count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-berry px-1 text-xs font-bold text-white">
          {cart.count}
        </span>
      )}
    </button>
  );
}
