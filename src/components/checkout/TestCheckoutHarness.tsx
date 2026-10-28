"use client";

import { useState } from "react";
import type { Product } from "@/commerce/types";
import { formatMoney } from "@/commerce/availability";
import { startCheckout } from "@/app/actions/checkout";
import { CartProvider, useCart } from "@/components/cart/Cart";

/**
 * Stripe TEST-mode harness (deploy previews / local dev only — the page that
 * renders this returns 404 everywhere else). Uses the real cart drawer, plus
 * buttons that send deliberately bad carts to prove the server rejects them.
 */

export type Attack = { label: string; lines: unknown; acceptedAtCatalogPrice?: boolean };

function Products({ products }: { products: Product[] }) {
  const cart = useCart()!;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {products.flatMap((p) =>
        p.variants.map((v) => (
          <li key={v.id} className="rounded-3xl bg-white p-5 ring-1 ring-inset ring-sky-200">
            <p className="font-display text-lg font-bold text-ink">{p.name}</p>
            <p className="text-ink-soft">{v.name}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {formatMoney(v.price)} · test stock {v.inventory.available} · ships from {v.fulfillmentSource === "supplier" ? "supplier (manual)" : "us"}
            </p>
            <button
              type="button"
              onClick={() => cart.add({ variantId: v.id, productName: p.name, variantName: v.name, price: v.price })}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-royal px-5 font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]"
            >
              Add to test cart
            </button>
          </li>
        )),
      )}
      <li className="sm:col-span-2">
        <button
          type="button"
          onClick={() => cart.setOpen(true)}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 font-display font-semibold text-royal ring-2 ring-inset ring-royal"
        >
          Open test cart ({cart.count})
        </button>
      </li>
    </ul>
  );
}

function Attacks({ attacks }: { attacks: Attack[] }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function run(a: Attack) {
    setBusy(a.label);
    const r = await startCheckout(a.lines as { variantId: string; quantity: number }[]);
    const verdict = r.ok
      ? a.acceptedAtCatalogPrice
        ? "OK: accepted at the catalog price — the browser's price was ignored (a test session was created; it expires on its own)"
        : "⚠️ ACCEPTED (unexpected)"
      : `Rejected: ${r.error}`;
    setResults((prev) => ({ ...prev, [a.label]: verdict }));
    setBusy(null);
  }
  return (
    <ul className="space-y-2">
      {attacks.map((a) => (
        <li key={a.label} className="flex flex-col gap-2 rounded-2xl bg-ice-50 p-3 ring-1 ring-inset ring-sky-200 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-ink">{a.label}</span>
          <span className="flex items-center gap-3">
            {results[a.label] && <span className="text-sm text-ink-soft">{results[a.label]}</span>}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run(a)}
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-royal ring-1 ring-inset ring-royal disabled:opacity-50"
            >
              {busy === a.label ? "Checking…" : "Try it"}
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TestCheckoutHarness({ products, attacks }: { products: Product[]; attacks: Attack[] }) {
  return (
    <CartProvider storageKey="funksquish-stripe-test-cart-v1">
      <div className="space-y-10">
        <section>
          <h2 className="font-display text-2xl font-bold text-ink">1. Happy path</h2>
          <p className="mt-1 text-ink-soft">
            Add items, open the cart, press <strong>Secure checkout</strong>, and pay on Stripe with test card{" "}
            <code>4242 4242 4242 4242</code> (any future date, any CVC). Use <code>4000 0000 0000 0002</code> for a declined card.
          </p>
          <div className="mt-4">
            <Products products={products} />
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold text-ink">2. Bad carts the server must reject</h2>
          <div className="mt-4">
            <Attacks attacks={attacks} />
          </div>
        </section>
      </div>
    </CartProvider>
  );
}
