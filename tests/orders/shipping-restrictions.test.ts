import { describe, expect, it } from "vitest";
import { isAllowedDestination } from "@/commerce/orders/shipping-restrictions";
import { fulfillCheckoutSession } from "@/commerce/orders/fulfill";
import { buildCheckoutSessionParams } from "@/commerce/checkout/stripe";
import { SESSION_ID, fakeDeps, snapshot } from "./helpers";

const us = (state: string | null, country: string | null = "US") => ({ country, state });

describe("shipping destinations (policy S2)", () => {
  it("allows states, D.C. and military addresses", () => {
    for (const s of ["KY", "AK", "HI", "DC", "AA", "AE", "AP", "ky"]) expect(isAllowedDestination(us(s))).toBe(true);
  });

  it("refuses U.S. territories and freely associated states that Stripe lists under 'US'", () => {
    for (const s of ["PR", "GU", "VI", "AS", "MP", "UM", "MH", "FM", "PW"]) expect(isAllowedDestination(us(s))).toBe(false);
  });

  it("refuses missing or non-US addresses", () => {
    expect(isAllowedDestination(null)).toBe(false);
    expect(isAllowedDestination(us(null))).toBe(false);
    expect(isAllowedDestination(us("ON", "CA"))).toBe(false);
  });

  it("flags a paid order shipped to a territory for refund instead of shipping", async () => {
    const base = snapshot();
    const f = fakeDeps(snapshot({ shippingAddress: { ...base.shippingAddress!, state: "PR", city: "San Juan", postalCode: "00901" } }));
    const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(r.state === "paid" && r.order.flags).toEqual(["restricted_destination"]);
  });

  it("does not flag a normal Kentucky order", async () => {
    const f = fakeDeps();
    const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(r.state === "paid" && r.order.flags).toEqual([]);
  });

  it("tells shoppers on Stripe's address form before they pay", () => {
    const params = buildCheckoutSessionParams({
      lines: [],
      checkoutId: "x",
      config: { secretKey: "sk_test_FAKE", shippingRateIds: ["shr_FAKE"], webhookSecret: null, returnOrigin: "http://localhost:3000", automaticTax: false },
      expiresAt: 1,
    });
    expect(params.custom_text?.shipping_address).toEqual({ message: expect.stringContaining("can't ship to U.S. territories") });
  });
});
