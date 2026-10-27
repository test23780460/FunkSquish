import { afterEach, describe, expect, it, vi } from "vitest";
import { checkedLine, quoteFor } from "./shipping-helpers";
import Stripe from "stripe";
import { readStripeLiveConfig, readStripeTestConfig, runtimeEnv } from "@/commerce/checkout/environment";
import { assertSession, buildCheckoutSessionParams, createStripeLiveClient, createStripeTestClient, PAYMENT_METHOD_TYPES } from "@/commerce/checkout/stripe";
import { fulfillCheckoutSession, orderNumberFor } from "@/commerce/orders/fulfill";
import { handleStripeEvent } from "@/commerce/orders/webhook";
import { fakeDeps, snapshot } from "../orders/helpers";
import { SHIPPING_ORIGINS, type ShippingOrigin } from "@/commerce/origins";
import { shippingTableFingerprint } from "@/commerce/shipping-approval";

/** A verified studio rule (made-up numbers) — what the owner will enter before launch. */
const VERIFIED: ShippingOrigin[] = SHIPPING_ORIGINS.map((o) => ({
  ...o,
  rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 500, cents: 650 }] },
  verified: { on: "2026-11-01", by: "owner", evidence: "private/shipping/usps-2026-11.pdf" },
})) as ShippingOrigin[];
const APPROVED = shippingTableFingerprint(VERIFIED);

// Fake values only — not real Stripe credentials.
const LIVE_ENV = {
  BUILD_CONTEXT: "production",
  STRIPE_LIVE_CHECKOUT_ENABLED: "true",
  STRIPE_LIVE_SECRET_KEY: "rk_live_FAKEFAKEFAKE123",
  STRIPE_LIVE_WEBHOOK_SECRET: "whsec_FAKElive123",
  STRIPE_LIVE_SHIPPING_TABLE: "", // set per test
};

describe("live configuration stays locked", () => {
  it("needs the code switch, production, the env switch, a live key, a webhook secret, verified shipping and the owner's approval of it", () => {
    const read = (env: Record<string, string | undefined>, code = true, origins = VERIFIED) => readStripeLiveConfig({ STRIPE_LIVE_SHIPPING_TABLE: APPROVED, ...env }, code, origins);
    expect(read(LIVE_ENV, false)).toEqual({ ok: false, problem: "code-switch-off" });
    const env = { ...LIVE_ENV, STRIPE_LIVE_SHIPPING_TABLE: APPROVED };
    expect(read({ ...env, BUILD_CONTEXT: "deploy-preview" })).toEqual({ ok: false, problem: "environment-not-allowed" });
    expect(read({ ...env, BUILD_CONTEXT: "", NODE_ENV: "development" })).toEqual({ ok: false, problem: "environment-not-allowed" });
    expect(read({ ...env, STRIPE_LIVE_CHECKOUT_ENABLED: "" })).toEqual({ ok: false, problem: "switch-off" });
    expect(read({ ...env, STRIPE_LIVE_SECRET_KEY: "" })).toEqual({ ok: false, problem: "missing-secret-key" });
    expect(read({ ...env, STRIPE_LIVE_SECRET_KEY: "sk_test_FAKE" })).toEqual({ ok: false, problem: "test-key-rejected" });
    expect(read({ ...env, STRIPE_LIVE_SECRET_KEY: "pk_live_FAKE" })).toEqual({ ok: false, problem: "invalid-secret-key" });
    expect(read({ ...env, STRIPE_LIVE_WEBHOOK_SECRET: "" })).toEqual({ ok: false, problem: "missing-webhook-secret" });
    // Shipping (replaces the old STRIPE_LIVE_SHIPPING_RATE_IDS, which set no price):
    expect(read(env, true, SHIPPING_ORIGINS)).toEqual({ ok: false, problem: "shipping-not-verified" }); // today: no verified rates
    expect(read({ ...env, STRIPE_LIVE_SHIPPING_TABLE: "" })).toEqual({ ok: false, problem: "shipping-not-approved" });
    expect(read({ ...env, STRIPE_LIVE_SHIPPING_TABLE: "ship_v1_0000000000000000" })).toEqual({ ok: false, problem: "shipping-not-approved" });
    // An old rate-id variable doesn't stand in for the approval.
    expect(read({ ...env, STRIPE_LIVE_SHIPPING_TABLE: "", STRIPE_LIVE_SHIPPING_RATE_IDS: "shr_FAKElive1" })).toEqual({ ok: false, problem: "shipping-not-approved" });
    const ok = read(env);
    expect(ok.ok && ok.config.returnOrigin).toBe("https://funksquish.com");
  });

  it("the site's real code switch is OFF", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    const { liveCodeSwitchOn } = await import("@/commerce/checkout/live");
    expect(liveCodeSwitchOn()).toBe(false);
  });

  it("test config never uses live variables, and never runs on production", () => {
    const env = { BUILD_CONTEXT: "production", STRIPE_TEST_CHECKOUT_ENABLED: "true", STRIPE_TEST_SECRET_KEY: "sk_test_FAKE123", STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE" };
    expect(readStripeTestConfig(env)).toEqual({ ok: false, problem: "environment-not-allowed" });
    expect(readStripeTestConfig({ ...env, BUILD_CONTEXT: "deploy-preview", STRIPE_TEST_SECRET_KEY: "sk_live_FAKE" })).toEqual({ ok: false, problem: "live-key-rejected" });
  });

  it("reads the frozen build context and deploy URL explicitly (Netlify runtime)", () => {
    const env = runtimeEnv();
    expect(Object.prototype.hasOwnProperty.call(env, "BUILD_CONTEXT")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(env, "BUILD_DEPLOY_URL")).toBe(true);
    const t = readStripeTestConfig({ BUILD_CONTEXT: "deploy-preview", STRIPE_TEST_CHECKOUT_ENABLED: "true", STRIPE_TEST_SECRET_KEY: "sk_test_FAKE123", STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE", BUILD_DEPLOY_URL: "https://deploy-preview-5--x.netlify.app" });
    expect(t.ok && t.config.returnOrigin).toBe("https://deploy-preview-5--x.netlify.app");
  });
});

describe("Stripe sessions per mode", () => {
  const lines = [checkedLine({ variantId: "v1", productId: "p1", sku: "S1", name: "Squish", quantity: 1, unitAmount: 899 })];
  const cfg = { returnOrigin: "https://funksquish.com", automaticTax: false };
  const shipping = quoteFor(lines);

  it("offers cards only, in both modes", () => {
    expect(PAYMENT_METHOD_TYPES).toEqual(["card"]);
    expect(buildCheckoutSessionParams({ lines, checkoutId: "c", config: cfg, shipping, expiresAt: 1, mode: "live" }).allowed_payment_method_types).toEqual(["card"]);
    expect(buildCheckoutSessionParams({ lines, checkoutId: "c", config: cfg, shipping, expiresAt: 1 }).allowed_payment_method_types).toEqual(["card"]);
  });

  it("live sessions return to the live order page and are tagged live", () => {
    const p = buildCheckoutSessionParams({ lines, checkoutId: "c", config: cfg, shipping, expiresAt: 1, mode: "live" });
    expect(p.success_url).toBe("https://funksquish.com/checkout/complete?session_id={CHECKOUT_SESSION_ID}");
    expect(p.metadata).toMatchObject({ funksquish_mode: "live" });
  });

  it("refuses a session or key from the other mode", () => {
    const live = { id: "cs_live_abc", livemode: true, url: "https://checkout.stripe.com/c/pay/cs_live_abc" };
    expect(assertSession(live, "live")).toBe(live.url);
    expect(() => assertSession(live, "test")).toThrow();
    expect(() => assertSession({ ...live, livemode: false }, "live")).toThrow();
    expect(() => assertSession({ ...live, id: "cs_test_abc" }, "live")).toThrow();
    expect(() => createStripeLiveClient({ secretKey: "sk_test_FAKE" })).toThrow();
    expect(() => createStripeTestClient({ secretKey: "rk_live_FAKE" })).toThrow();
    expect(() => createStripeLiveClient({ secretKey: "rk_live_FAKE123" })).not.toThrow();
  });
});

describe("order processing per mode", () => {
  it("a live store never records a test session, and the other way round", async () => {
    const f = fakeDeps();
    f.deps.mode = "live";
    expect(await fulfillCheckoutSession("cs_test_a1B2c3D4e5F6g7H8", f.deps, "x", "x")).toEqual({ state: "invalid" });
    const g = fakeDeps(snapshot({ id: "cs_live_a1B2c3D4e5F6g7H8", livemode: true }));
    g.deps.mode = "live";
    const r = await fulfillCheckoutSession("cs_live_a1B2c3D4e5F6g7H8", g.deps, "x", "x");
    expect(r.state).toBe("paid");
    expect(r.state === "paid" && r.order.mode).toBe("live");
    expect(r.state === "paid" && r.order.id).toMatch(/^FS-\d{8}-[0-9A-F]{8}$/);
    const t = fakeDeps(snapshot({ id: "cs_live_a1B2c3D4e5F6g7H8", livemode: true }));
    expect(await fulfillCheckoutSession("cs_live_a1B2c3D4e5F6g7H8", t.deps, "x", "x")).toEqual({ state: "invalid" });
    expect(orderNumberFor("cs_test_x", new Date("2026-10-27"), "test")).toMatch(/^FS-T-/);
  });

  it("webhooks reject events from the other mode", async () => {
    const f = fakeDeps();
    f.deps.mode = "live";
    const ev = { id: "evt_1", type: "checkout.session.completed", livemode: false, data: { object: {} } };
    await expect(handleStripeEvent(ev, f.deps)).rejects.toThrow(/Test-mode event rejected by the live/);
    await expect(handleStripeEvent({ ...ev, livemode: true }, fakeDeps().deps)).rejects.toThrow(/Live-mode event rejected by the test/);
  });
});

describe("live webhook endpoint", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("is 404 while live checkout is locked, even with a valid live signature", async () => {
    vi.doMock("server-only", () => ({}));
    for (const [k, v] of Object.entries(LIVE_ENV)) vi.stubEnv(k, v);
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const body = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", livemode: true, data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: LIVE_ENV.STRIPE_LIVE_WEBHOOK_SECRET });
    const res = await POST(new Request("https://funksquish.com/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header }, body }));
    expect(res.status).toBe(404); // the code switch in src/lib/features.ts is off
  });
});
