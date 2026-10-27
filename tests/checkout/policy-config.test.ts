import { describe, expect, it } from "vitest";
import { buildCheckoutSessionParams, PAYMENT_METHOD_TYPES, TERMS_NOTICE } from "@/commerce/checkout/stripe";
import { SHIPPING_AREA_NOTE } from "@/commerce/orders/shipping-restrictions";
import { checkedLine, quoteFor } from "./shipping-helpers";

/**
 * Owner decision (Part 8): cards and card wallets only at launch, Link off.
 * What the code controls, checked against the policies. Turning Link off is a
 * Stripe Dashboard setting (docs/OWNER-ACTIONS.md) — the code never asks for it,
 * and preview check V-25 confirms the page doesn't show it.
 */
const lines = [checkedLine({ variantId: "v1" }), checkedLine({ variantId: "v2", fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-a" })];
const cfg = { returnOrigin: "https://funksquish.com", shippingRateIds: ["shr_X"], automaticTax: true };

describe.each(["test", "live"] as const)("Checkout configuration (%s mode) matches the policies", (mode) => {
  const p = buildCheckoutSessionParams({ lines, checkoutId: "11111111-2222-3333-4444-555555555555", config: cfg, shipping: quoteFor(lines), expiresAt: 2_000_000_000, mode });
  const json = JSON.stringify(p);

  it("cards only (Apple Pay / Google Pay count as cards); nothing else is requested", () => {
    expect(PAYMENT_METHOD_TYPES).toEqual(["card"]);
    expect(p.allowed_payment_method_types).toEqual(["card"]);
    expect(p).not.toHaveProperty("payment_method_types");
    expect(p).not.toHaveProperty("payment_method_configuration"); // would let Dashboard settings add methods
    expect(json).not.toMatch(/"link"|klarna|afterpay|affirm|us_bank_account|cashapp|paypal/);
  });

  it("no saved cards, customer accounts, promotion codes or marketing consent", () => {
    for (const key of ["customer_creation", "saved_payment_method_options", "allow_promotion_codes", "discounts", "consent_collection", "subscription_data", "setup_intent_data"])
      expect(p, key).not.toHaveProperty(key);
    expect(p.payment_intent_data).not.toHaveProperty("setup_future_usage");
  });

  it("a one-time payment, U.S. addresses only, tax added on top, one shipping charge, policies shown at Pay", () => {
    expect(p.mode).toBe("payment");
    expect(p.submit_type).toBe("pay");
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.shipping_options).toHaveLength(1);
    expect(p.custom_text?.submit).toEqual({ message: TERMS_NOTICE });
    expect(p.custom_text?.shipping_address?.message).toContain(SHIPPING_AREA_NOTE);
    for (const li of p.line_items ?? []) expect(li.price_data?.tax_behavior).toBe("exclusive");
  });

  it("never charges for signature confirmation or anything else beyond items, shipping and tax", () => {
    expect(json).not.toMatch(/signature/i);
    expect(p.line_items?.every((li) => li.price_data?.product_data?.metadata?.variant_id)).toBe(true);
  });
});
