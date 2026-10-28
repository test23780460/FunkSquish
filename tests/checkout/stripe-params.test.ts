import { describe, expect, it } from "vitest";
import { assertTestSession, buildCheckoutSessionParams, createStripeTestClient, STRIPE_API_VERSION } from "@/commerce/checkout/stripe";
import type { StripeTestConfig } from "@/commerce/checkout/environment";

const config: StripeTestConfig = {
  secretKey: "sk_test_FAKEFAKEFAKE123",
  shippingRateIds: ["shr_FAKE1", "shr_FAKE2"],
  webhookSecret: "whsec_FAKE",
  returnOrigin: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
  automaticTax: false,
};

const lines = [
  { variantId: "test-var-jelly-blue", productId: "test-fixture-jelly", sku: "TEST-JELLY-BLUE", name: "TEST Jelly — Blue", quantity: 2, unitAmount: 500, currency: "usd" as const, fulfillmentSource: "in_house" as const },
  { variantId: "test-var-supplier-mint", productId: "test-fixture-supplier", sku: "TEST-SUPPLIER-MINT", name: "TEST Supplier — Mint", quantity: 1, unitAmount: 750, currency: "usd" as const, fulfillmentSource: "supplier" as const },
];

describe("buildCheckoutSessionParams", () => {
  const params = buildCheckoutSessionParams({ lines, checkoutId: "11111111-2222-3333-4444-555555555555", config, expiresAt: 1_800_000_000 });

  it("creates a one-time payment session priced from server data", () => {
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([
      expect.objectContaining({ quantity: 2, price_data: expect.objectContaining({ currency: "usd", unit_amount: 500 }) }),
      expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ currency: "usd", unit_amount: 750 }) }),
    ]);
  });

  it("tags each line with variant, SKU and fulfillment source for order processing", () => {
    expect(params.line_items?.[1].price_data?.product_data?.metadata).toEqual({
      variant_id: "test-var-supplier-mint",
      product_id: "test-fixture-supplier",
      sku: "TEST-SUPPLIER-MINT",
      fulfillment_source: "supplier",
    });
  });

  it("links the session to our checkout id", () => {
    expect(params.client_reference_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(params.metadata).toMatchObject({ checkout_id: "11111111-2222-3333-4444-555555555555", funksquish_mode: "test" });
    expect(params.payment_intent_data?.metadata).toMatchObject({ checkout_id: "11111111-2222-3333-4444-555555555555" });
  });

  it("collects a U.S. shipping address and offers only configured rates", () => {
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(params.shipping_options).toEqual([{ shipping_rate: "shr_FAKE1" }, { shipping_rate: "shr_FAKE2" }]);
  });

  it("returns to the preview, never to production", () => {
    expect(params.success_url).toBe(`${config.returnOrigin}/checkout/test-result?session_id={CHECKOUT_SESSION_ID}`);
    expect(params.cancel_url).toContain(`${config.returnOrigin}/checkout/test-result?canceled=1&checkout=`);
    expect(params.success_url).not.toContain("funksquish.com/");
  });

  it("expires so held stock is released, and leaves tax off unless configured", () => {
    expect(params.expires_at).toBe(1_800_000_000);
    expect(params.automatic_tax).toEqual({ enabled: false });
    expect(buildCheckoutSessionParams({ lines, checkoutId: "x", config: { ...config, automaticTax: true }, expiresAt: 1 }).automatic_tax).toEqual({ enabled: true });
  });
});

describe("assertTestSession", () => {
  const good = { id: "cs_test_abc", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_abc" };
  it("accepts a test session hosted by Stripe", () => {
    expect(assertTestSession(good)).toBe(good.url);
  });
  it("rejects live sessions, odd ids and foreign hosts", () => {
    expect(() => assertTestSession({ ...good, livemode: true })).toThrow();
    expect(() => assertTestSession({ ...good, id: "cs_live_abc" })).toThrow();
    expect(() => assertTestSession({ ...good, url: "https://evil.example/pay" })).toThrow();
    expect(() => assertTestSession({ ...good, url: null })).toThrow();
  });
});

describe("createStripeTestClient", () => {
  it("pins the API version", () => {
    expect(STRIPE_API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });
  it("refuses live or malformed keys", () => {
    expect(() => createStripeTestClient({ ...config, secretKey: "sk_live_FAKE" })).toThrow();
    expect(() => createStripeTestClient({ ...config, secretKey: "pk_test_FAKE" })).toThrow();
    expect(() => createStripeTestClient(config)).not.toThrow();
  });
});
