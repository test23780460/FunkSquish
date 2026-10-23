"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Money } from "@/commerce/types";
import { formatMoney } from "@/commerce/availability";
import { startCheckout } from "@/app/actions/checkout";
import { CloseIcon, LockIcon } from "@/components/icons/Icons";

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

const KEY = "funksquish-cart-v1";
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  try {
    lines = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    lines = [];
  }
}
function save(next: CartLine[]) {
  lines = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: cart still works for this visit */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const current = useSyncExternalStore(
    subscribe,
    () => {
      if (!loaded) {
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
          ? lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity: Math.min(10, l.quantity + quantity) } : l))
          : [...lines, { ...line, quantity }],
      );
      setOpen(true);
    },
    setQuantity(variantId, quantity) {
      save(lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(10, quantity)) } : l)));
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (cart.open && !d.open) d.showModal();
    if (!cart.open && d.open) d.close();
  }, [cart.open]);

  const subtotal = cart.lines.every((l) => l.price)
    ? { amount: cart.lines.reduce((s, l) => s + (l.price?.amount ?? 0) * l.quantity, 0), currency: "USD" as const }
    : null;

  async function checkout() {
    setPending(true);
    setError(null);
    const result = await startCheckout(cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })));
    if (result.ok) window.location.assign(result.url);
    else {
      setError(result.error);
      setPending(false);
    }
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
          <p className="mt-1 text-sm text-ink-soft">Shipping and tax are calculated at checkout.</p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-berry-soft px-3 py-2 text-sm text-ink">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={checkout}
            disabled={pending || cart.lines.length === 0}
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
