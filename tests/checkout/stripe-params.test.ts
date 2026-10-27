import { describe, expect, it } from "vitest";
import { assertTestSession, buildCheckoutSessionParams, createStripeTestClient, STRIPE_API_VERSION } from "@/commerce/checkout/stripe";
import type { StripeTestConfig } from "@/commerce/checkout/environment";
import { checkedLine, quoteFor } from "./shipping-helpers";

const config: StripeTestConfig = {
  secretKey: "sk_test_FAKEFAKEFAKE123",
  webhookSecret: "whsec_FAKE",
  returnOrigin: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
  automaticTax: false,
};

const lines = [
  checkedLine({ variantId: "test-var-jelly-blue", productId: "test-fixture-jelly", sku: "TEST-JELLY-BLUE", name: "TEST Jelly — Blue", quantity: 2, unitAmount: 500 }),
  checkedLine({ variantId: "test-var-supplier-mint", productId: "test-fixture-supplier", sku: "TEST-SUPPLIER-MINT", name: "TEST Supplier — Mint", quantity: 1, unitAmount: 750, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-a" }),
];
const shipping = quoteFor(lines);

describe("buildCheckoutSessionParams", () => {
  const params = buildCheckoutSessionParams({ lines, checkoutId: "11111111-2222-3333-4444-555555555555", config, shipping, expiresAt: 1_800_000_000 });

  it("creates a one-time payment session priced from server data", () => {
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([
      expect.objectContaining({ quantity: 2, price_data: expect.objectContaining({ currency: "usd", unit_amount: 500 }) }),
      expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ currency: "usd", unit_amount: 750 }) }),
    ]);
  });

  it("tags each line with variant, SKU, fulfillment source and origin for order processing", () => {
    expect(params.line_items?.[1].price_data?.product_data?.metadata).toEqual({
      variant_id: "test-var-supplier-mint",
      product_id: "test-fixture-supplier",
      sku: "TEST-SUPPLIER-MINT",
      fulfillment_source: "supplier",
      fulfillment_origin: "test-supplier-a",
    });
  });

  it("adds sales tax on top of prices and shipping (never included in them)", () => {
    for (const li of params.line_items ?? []) expect(li.price_data?.tax_behavior).toBe("exclusive");
    expect(params.shipping_options?.[0].shipping_rate_data).toMatchObject({ tax_behavior: "exclusive", tax_code: "txcd_92010001" });
  });

  it("links the session to our checkout id", () => {
    expect(params.client_reference_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(params.metadata).toMatchObject({ checkout_id: "11111111-2222-3333-4444-555555555555", funksquish_mode: "test" });
    expect(params.payment_intent_data?.metadata).toMatchObject({ checkout_id: "11111111-2222-3333-4444-555555555555" });
  });

  it("collects a U.S. shipping address and offers exactly one shipping charge: the server's quote for every package", () => {
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(params.shipping_options).toHaveLength(1);
    expect(params.shipping_options?.[0].shipping_rate_data).toMatchObject({
      type: "fixed_amount",
      display_name: "Shipping (2 packages)",
      fixed_amount: { amount: 900, currency: "usd" },
    });
    // The fixed Dashboard rates no longer set the price (they stay a required lock in environment.ts).
    expect(JSON.stringify(params.shipping_options)).not.toContain("shr_FAKE");
    expect(params.metadata?.shipping_plan).toBe("v1;test-studio:h:450:2:1;test-supplier-a:s:450:3:1");
  });

  it("refuses to build a session without a quote covering every line", () => {
    expect(() => buildCheckoutSessionParams({ lines, checkoutId: "x", config, shipping: { packages: [], totalCents: 0 }, expiresAt: 1 })).toThrow();
    expect(() => buildCheckoutSessionParams({ lines, checkoutId: "x", config, shipping: quoteFor(lines.slice(0, 1)), expiresAt: 1 })).toThrow();
  });

  it("returns to the preview, never to production", () => {
    expect(params.success_url).toBe(`${config.returnOrigin}/checkout/test-result?session_id={CHECKOUT_SESSION_ID}`);
    expect(params.cancel_url).toContain(`${config.returnOrigin}/checkout/test-result?canceled=1&checkout=`);
    expect(params.success_url).not.toContain("funksquish.com/");
  });

  it("expires so held stock is released, and leaves tax off unless configured", () => {
    expect(params.expires_at).toBe(1_800_000_000);
    expect(params.automatic_tax).toEqual({ enabled: false });
    expect(buildCheckoutSessionParams({ lines, checkoutId: "x", config: { ...config, automaticTax: true }, shipping, expiresAt: 1 }).automatic_tax).toEqual({ enabled: true });
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
