import Stripe from "stripe";
import { isLiveKey, type StripeTestConfig } from "./environment";
import type { CheckedLine } from "./validate-cart";

/**
 * Stripe helpers for the TEST integration (server-only).
 * API version is pinned to the one this SDK release targets, so behaviour
 * doesn't change if the account default is upgraded in the Dashboard.
 */
export const STRIPE_API_VERSION = Stripe.API_VERSION;

/** Stripe requires Checkout Sessions to stay open at least 30 minutes. */
export const SESSION_LIFETIME_SECONDS = 30 * 60 + 60;

export function createStripeTestClient(config: StripeTestConfig): Stripe {
  if (isLiveKey(config.secretKey) || !/^(sk|rk)_test_/.test(config.secretKey)) {
    throw new Error("Refusing to create a Stripe client without a TEST key.");
  }
  return new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    timeout: 15_000,
    appInfo: { name: "FunkSquish (test mode)" },
  });
}

/** Pure: build the Checkout Session request from server-validated lines. */
export function buildCheckoutSessionParams(input: {
  lines: CheckedLine[];
  checkoutId: string;
  config: StripeTestConfig;
  expiresAt: number;
}): Stripe.Checkout.SessionCreateParams {
  const { lines, checkoutId, config, expiresAt } = input;
  const origin = config.returnOrigin;
  return {
    mode: "payment",
    client_reference_id: checkoutId,
    metadata: { checkout_id: checkoutId, funksquish_mode: "test" },
    payment_intent_data: { metadata: { checkout_id: checkoutId, funksquish_mode: "test" } },
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
    // U.S. only (policy S2). "US" covers all 50 states and APO/FPO/DPO
    // (AA/AE/AP); U.S. territories have their own country codes and are excluded.
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: config.shippingRateIds.map((id) => ({ shipping_rate: id })),
    automatic_tax: { enabled: config.automaticTax },
    expires_at: expiresAt,
    submit_type: "pay",
    success_url: `${origin}/checkout/test-result?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/test-result?canceled=1&checkout=${encodeURIComponent(checkoutId)}`,
  };
}

/** Sanity-check Stripe's reply before sending a shopper anywhere. */
export function assertTestSession(session: Pick<Stripe.Checkout.Session, "id" | "livemode" | "url">): string {
  if (session.livemode !== false || !session.id.startsWith("cs_test_") || !session.url) {
    throw new Error("Unexpected Stripe session (not test mode).");
  }
  const host = new URL(session.url).hostname;
  if (host !== "checkout.stripe.com") throw new Error("Unexpected Stripe checkout host.");
  return session.url;
}
