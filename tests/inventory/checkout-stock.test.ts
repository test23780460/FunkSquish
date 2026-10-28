import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKvStore } from "@/commerce/orders/store";
import { adjustStock, setPaused } from "@/commerce/orders/stock-admin";

// Fake values only — not real Stripe credentials.
const ENV = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
};
const state = { store: new MemoryKvStore(), create: vi.fn() };

vi.mock("server-only", () => ({}));
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getTestOrderStore: async () => state.store }));
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeTestClient: () => ({ checkout: { sessions: { create: state.create, expire: vi.fn(), retrieve: vi.fn() } } }),
}));

const { startCheckout, quoteCheckout } = await import("@/app/actions/checkout");

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, ENV);
  state.store = new MemoryKvStore();
  state.create = vi.fn(async () => ({ id: "cs_test_abcdefghij123", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_abcdefghij123" }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
});

const sale = (variantId: string, quantity: number) =>
  adjustStock(state.store, { variantId, sku: variantId, kind: "tiktok-sale", quantity, requestId: randomUUID(), catalogOnHand: 5 });

describe("the website sees manual stock changes immediately", () => {
  it("a TikTok sale shows in the cart and stops checkout from overselling", async () => {
    await sale("test-var-jelly-blue", 4); // 5 → 1
    const q = await quoteCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    expect(q).toEqual({ ok: false, error: "Only 1 of TEST Jelly Squish (test mode) — Blue left. Please lower the quantity.", blocked: [{ variantId: "test-var-jelly-blue", message: expect.any(String) }] });
    expect(await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }])).toEqual({ ok: false, error: expect.stringContaining("Only 1") });
    expect(state.create).not.toHaveBeenCalled();
    expect((await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }])).ok).toBe(true);
  });

  it("a paused item can't be checked out; the rest of the store can", async () => {
    await setPaused(state.store, ["test-var-supplier-mint"], true, "TikTok LIVE", "live");
    expect(await quoteCheckout([{ variantId: "test-var-supplier-mint", quantity: 1 }])).toMatchObject({ ok: false, error: expect.stringContaining("paused on the website") });
    expect(await startCheckout([{ variantId: "test-var-supplier-mint", quantity: 1 }])).toEqual({ ok: false, error: expect.stringContaining("paused on the website") });
    expect((await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }])).ok).toBe(true);
  });
});
