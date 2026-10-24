import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { stripeTestConfig, type StripeTestConfig } from "./environment";
import { TEST_FIXTURE_PRODUCTS, isTestFixtureVariant } from "./test-fixtures";
import { normalizeCartLines, validateCartAgainstCatalog } from "./validate-cart";
import { assertTestSession, buildCheckoutSessionParams, createStripeTestClient, SESSION_LIFETIME_SECONDS } from "./stripe";
import { releaseStock, reserveStock } from "../orders/inventory";
import { getTestOrderStore } from "../orders/store";
import { snapshotFromStripeSession } from "../orders/session-snapshot";
import type { OrderDeps } from "../orders/fulfill";

/**
 * Server-side wiring for the Stripe TEST integration. Every entry point
 * re-checks the environment guard, so none of this can run on production.
 */

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const checkoutKey = (checkoutId: string) => `checkout/${checkoutId}`;

function onHand(variantId: string): number | null {
  for (const p of TEST_FIXTURE_PRODUCTS) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return v.inventory.available;
  }
  return null;
}

async function retrieveSnapshot(stripe: Stripe, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const items = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100, expand: ["data.price.product"] });
  return snapshotFromStripeSession({ ...session, line_items: items } as Stripe.Checkout.Session);
}

export async function orderDepsFor(config: StripeTestConfig): Promise<OrderDeps> {
  const stripe = createStripeTestClient(config);
  const store = await getTestOrderStore();
  return {
    store,
    retrieveSession: (id) => retrieveSnapshot(stripe, id),
    onHand,
    now: () => new Date(),
  };
}

export async function startTestCheckout(rawLines: unknown): Promise<StartCheckoutResult> {
  const config = stripeTestConfig();
  if (!config) return { ok: false, error: "Checkout isn't open yet." };

  const normalized = normalizeCartLines(rawLines);
  if (!normalized.ok) return { ok: false, error: normalized.message };
  const checked = validateCartAgainstCatalog(normalized.value, TEST_FIXTURE_PRODUCTS, (_p, v) => isTestFixtureVariant(v.id));
  if (!checked.ok) return { ok: false, error: checked.message };

  const store = await getTestOrderStore();
  const checkoutId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_LIFETIME_SECONDS;

  const reserved = await reserveStock(
    store,
    checkoutId,
    checked.value.map((l) => ({ variantId: l.variantId, quantity: l.quantity, onHand: onHand(l.variantId) ?? 0 })),
    expiresAt,
    now,
  );
  if (!reserved.ok) {
    const line = checked.value.find((l) => l.variantId === reserved.variantId);
    return {
      ok: false,
      error:
        reserved.available > 0
          ? `Only ${reserved.available} of ${line?.name ?? "an item"} can be ordered right now. Please lower the quantity.`
          : `${line?.name ?? "An item"} just sold out. Please remove it to continue.`,
    };
  }

  try {
    const stripe = createStripeTestClient(config);
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({ lines: checked.value, checkoutId, config, expiresAt }),
      { idempotencyKey: `funksquish-checkout-${checkoutId}` },
    );
    const url = assertTestSession(session);
    await store.create(checkoutKey(checkoutId), { sessionId: session.id });
    return { ok: true, url };
  } catch (err) {
    await releaseStock(store, checkoutId);
    // Log the error class/code only — Stripe messages can echo request data.
    const code = (err as { code?: string; type?: string })?.code ?? (err as { type?: string })?.type ?? "unknown";
    console.error("[stripe-test] checkout session failed:", code);
    return { ok: false, error: "We couldn't start checkout. Nothing was charged — please try again in a moment." };
  }
}

/**
 * Shopper pressed "back" on Stripe's page. Expire the session so it can't be
 * paid later, then free the stock. Safe to call repeatedly.
 */
export async function cancelTestCheckout(checkoutId: string): Promise<void> {
  const config = stripeTestConfig();
  if (!config || !/^[0-9a-f-]{36}$/.test(checkoutId)) return;
  const store = await getTestOrderStore();
  const link = await store.get<{ sessionId: string }>(checkoutKey(checkoutId));
  if (link) {
    try {
      const stripe = createStripeTestClient(config);
      const session = await stripe.checkout.sessions.retrieve(link.value.sessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(link.value.sessionId);
      if (session.status === "complete") return; // already paid — never release
    } catch {
      return; // leave the hold; it expires on its own at expires_at
    }
  }
  await releaseStock(store, checkoutId);
}
