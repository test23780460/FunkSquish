import { describe, expect, it } from "vitest";
import { readStripeTestConfig, returnOriginFrom, stripeTestEnvironmentAllowed } from "@/commerce/checkout/environment";

// Fake values only — these are not real Stripe credentials.
const ok = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_FAKE123",
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
};

describe("Stripe test environment guard", () => {
  it("accepts a fully configured deploy preview", () => {
    const r = readStripeTestConfig(ok);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.returnOrigin).toBe("https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app");
      expect(r.config.webhookSecret).toBe("whsec_FAKE123");
      expect(r.config.automaticTax).toBe(false);
    }
  });

  it("never runs on Netlify production, even fully configured", () => {
    expect(readStripeTestConfig({ ...ok, BUILD_CONTEXT: "production" })).toEqual({ ok: false, problem: "environment-not-allowed" });
    expect(readStripeTestConfig({ ...ok, BUILD_CONTEXT: "", CONTEXT: "production" })).toEqual({ ok: false, problem: "environment-not-allowed" });
  });

  it("never runs on branch deploys or unknown contexts", () => {
    expect(stripeTestEnvironmentAllowed({ BUILD_CONTEXT: "branch-deploy" })).toBe(false);
    expect(stripeTestEnvironmentAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(stripeTestEnvironmentAllowed({})).toBe(false);
  });

  it("allows local development", () => {
    expect(stripeTestEnvironmentAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("stays off unless the test switch is on", () => {
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_CHECKOUT_ENABLED: undefined })).toEqual({ ok: false, problem: "switch-off" });
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_CHECKOUT_ENABLED: "1" })).toEqual({ ok: false, problem: "switch-off" });
  });

  it("rejects live keys outright", () => {
    for (const key of ["sk_live_FAKE123", "rk_live_FAKE123", "pk_live_FAKE123"]) {
      expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SECRET_KEY: key })).toEqual({ ok: false, problem: "live-key-rejected" });
    }
  });

  it("rejects missing or malformed credentials", () => {
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SECRET_KEY: "" })).toEqual({ ok: false, problem: "missing-secret-key" });
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SECRET_KEY: "pk_test_FAKE" })).toEqual({ ok: false, problem: "invalid-secret-key" });
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SECRET_KEY: "sk_test_has spaces" })).toEqual({ ok: false, problem: "invalid-secret-key" });
  });

  it("treats a malformed webhook secret as not configured", () => {
    const r = readStripeTestConfig({ ...ok, STRIPE_TEST_WEBHOOK_SECRET: "not-a-secret" });
    expect(r.ok && r.config.webhookSecret).toBe(null);
  });

  it("no longer needs (or reads) Stripe shipping-rate ids: shipping is priced by the server (D-SHIP-3)", () => {
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SHIPPING_RATE_ID: "" }).ok).toBe(true);
    expect(readStripeTestConfig({ ...ok, STRIPE_TEST_SHIPPING_RATE_ID: "rate_123" }).ok).toBe(true); // an old leftover value is harmless
    const r = readStripeTestConfig({ ...ok, STRIPE_TEST_SHIPPING_RATE_IDS: "shr_A1, shr_B2" });
    expect(r.ok && Object.keys(r.config)).not.toContain("shippingRateIds");
  });

  it("only returns shoppers to safe, non-production origins", () => {
    expect(returnOriginFrom({ STRIPE_TEST_RETURN_ORIGIN: "https://funksquish.com" })).toBe(null);
    expect(returnOriginFrom({ STRIPE_TEST_RETURN_ORIGIN: "https://www.funksquish.com/x" })).toBe(null);
    expect(returnOriginFrom({ STRIPE_TEST_RETURN_ORIGIN: "http://evil.example" })).toBe(null);
    expect(returnOriginFrom({ STRIPE_TEST_RETURN_ORIGIN: "https://user:pw@preview.netlify.app" })).toBe(null);
    expect(returnOriginFrom({ STRIPE_TEST_RETURN_ORIGIN: "http://localhost:3000/path" })).toBe("http://localhost:3000");
    expect(returnOriginFrom({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(returnOriginFrom({})).toBe(null);
  });
});
