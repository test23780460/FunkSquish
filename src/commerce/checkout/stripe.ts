import Stripe from "stripe";
import { isLiveKey, type StripeLiveConfig, type StripeTestConfig } from "./environment";
import type { CheckedLine } from "./validate-cart";
import { SHIPPING_AREA_NOTE } from "../orders/shipping-restrictions";

/**
 * Stripe helpers (server-only) for both modes. Test and live share the same
 * session shape; everything that differs — key prefix, return pages, the
 * livemode flag Stripe must report — is checked per mode, so a test key can
 * never produce a "live" session or the other way round.
 * API version is pinned to the one this SDK release targets, so behaviour
 * doesn't change if the account default is upgraded in the Dashboard.
 */
export const STRIPE_API_VERSION = Stripe.API_VERSION;

export type StripeMode = "test" | "live";

/** Stripe requires Checkout Sessions to stay open at least 30 minutes. */
export const SESSION_LIFETIME_SECONDS = 30 * 60 + 60;

/**
 * Payment methods offered at launch: cards only (including Apple Pay / Google
 * Pay wallets, which Stripe treats as cards). Delayed methods such as bank
 * debits or buy-now-pay-later stay off until their "payment still pending"
 * path is tested end to end (see docs/STRIPE-PRODUCTION.md).
 */
export const PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] = ["card"];

const KEY_PATTERN: Record<StripeMode, RegExp> = { test: /^(sk|rk)_test_/, live: /^(sk|rk)_live_/ };

function createClient(mode: StripeMode, secretKey: string): Stripe {
  if (!KEY_PATTERN[mode].test(secretKey) || (mode === "test" && isLiveKey(secretKey))) {
    throw new Error(`Refusing to create a Stripe client: the key isn't a ${mode.toUpperCase()} key.`);
  }
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    timeout: 15_000,
    appInfo: { name: mode === "test" ? "FunkSquish (test mode)" : "FunkSquish" },
  });
}

export function createStripeTestClient(config: Pick<StripeTestConfig, "secretKey">): Stripe {
  return createClient("test", config.secretKey);
}

export function createStripeLiveClient(config: Pick<StripeLiveConfig, "secretKey">): Stripe {
  return createClient("live", config.secretKey);
}

/** Where Stripe sends the shopper back. Test pages are 404 on production; the live page is 404 elsewhere. */
export const RETURN_PATHS: Record<StripeMode, { success: string; cancel: string }> = {
  test: { success: "/checkout/test-result", cancel: "/checkout/test-result" },
  live: { success: "/checkout/complete", cancel: "/checkout/complete" },
};

/** Pure: build the Checkout Session request from server-validated lines. */
export function buildCheckoutSessionParams(input: {
  lines: CheckedLine[];
  checkoutId: string;
  config: Pick<StripeTestConfig, "returnOrigin" | "shippingRateIds" | "automaticTax"> & { secretKey?: string; webhookSecret?: string | null };
  expiresAt: number;
  mode?: StripeMode;
}): Stripe.Checkout.SessionCreateParams {
  const { lines, checkoutId, config, expiresAt, mode = "test" } = input;
  const origin = config.returnOrigin;
  const paths = RETURN_PATHS[mode];
  return {
    mode: "payment",
    // A filter on what Stripe would otherwise offer: only cards (and card wallets) get through.
    allowed_payment_method_types: PAYMENT_METHOD_TYPES,
    client_reference_id: checkoutId,
    metadata: { checkout_id: checkoutId, funksquish_mode: mode },
    payment_intent_data: { metadata: { checkout_id: checkoutId, funksquish_mode: mode } },
    line_items: lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: line.currency,
        unit_amount: line.unitAmount,
        product_data: {
          name: line.name,
          metadata: {
            variant_id: line.variantId,
            product_id: line.productId,
            sku: line.sku,
            fulfillment_source: line.fulfillmentSource,
          },
        },
      },
    })),
    // U.S. only (policy S2). Stripe's "US" also lists territories (PR, GU, VI…)
    // as states and hosted Checkout can't hide them, so shoppers see a note here
    // and any territory order is flagged for refund (see shipping-restrictions.ts).
    shipping_address_collection: { allowed_countries: ["US"] },
    custom_text: { shipping_address: { message: SHIPPING_AREA_NOTE } },
    shipping_options: config.shippingRateIds.map((id) => ({ shipping_rate: id })),
    automatic_tax: { enabled: config.automaticTax },
    expires_at: expiresAt,
    submit_type: "pay",
    success_url: `${origin}${paths.success}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${paths.cancel}?canceled=1&checkout=${encodeURIComponent(checkoutId)}`,
  };
}

/** Sanity-check Stripe's reply before sending a shopper anywhere. */
export function assertSession(session: Pick<Stripe.Checkout.Session, "id" | "livemode" | "url">, mode: StripeMode): string {
  const live = mode === "live";
  if (session.livemode !== live || !session.id.startsWith(live ? "cs_live_" : "cs_test_") || !session.url) {
    throw new Error(`Unexpected Stripe session (not ${mode} mode).`);
  }
  const host = new URL(session.url).hostname;
  if (host !== "checkout.stripe.com") throw new Error("Unexpected Stripe checkout host.");
  return session.url;
}

export function assertTestSession(session: Pick<Stripe.Checkout.Session, "id" | "livemode" | "url">): string {
  return assertSession(session, "test");
}
