import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKvStore } from "@/commerce/orders/store";
import { availableUnits, type VariantLedger } from "@/commerce/orders/inventory";

// Fake values only — not real Stripe credentials.
const ENV = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
};

const state = {
  store: new MemoryKvStore(),
  create: vi.fn(),
  expire: vi.fn(),
  retrieve: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getTestOrderStore: async () => state.store }));
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeTestClient: () => ({ checkout: { sessions: { create: state.create, expire: state.expire, retrieve: state.retrieve } } }),
}));

const { startCheckout } = await import("@/app/actions/checkout");
const { cancelTestCheckout } = await import("@/commerce/checkout/service");

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, ENV);
  state.store = new MemoryKvStore();
  state.create = vi.fn(async () => ({ id: "cs_test_abcdefghij123", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_abcdefghij123" }));
  state.expire = vi.fn(async () => ({}));
  state.retrieve = vi.fn(async () => ({ status: "open" }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
});

async function left(variantId: string, onHand: number) {
  const ledger = (await state.store.get<VariantLedger>(`stock/${variantId}`))?.value ?? null;
  return availableUnits(onHand, ledger, Math.floor(Date.now() / 1000));
}

describe("startCheckout (Stripe test mode)", () => {
  it("returns Stripe's hosted URL, holds stock, and sends server prices with an idempotency key", async () => {
    const r = await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    const [params, options] = state.create.mock.calls[0] as unknown as [Record<string, unknown>, { idempotencyKey: string }];
    // The checkout id lets the cart be cleared later, but only for a verified paid result of this same checkout.
    expect(r).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_abcdefghij123", checkoutId: params.client_reference_id });
    expect(options.idempotencyKey).toBe(`funksquish-checkout-${params.client_reference_id}`);
    expect(params).toMatchObject({ mode: "payment", line_items: [expect.objectContaining({ quantity: 2, price_data: expect.objectContaining({ unit_amount: 500 }) })] });
    expect(options.idempotencyKey).toMatch(/^funksquish-checkout-[0-9a-f-]{36}$/);
    expect(await left("test-var-jelly-blue", 5)).toBe(3);
  });

  it("rejects bad carts before contacting Stripe", async () => {
    for (const lines of [[], [{ variantId: "test-var-jelly-blue", quantity: 0 }], [{ variantId: "pv-berry-slushie-strawberry", quantity: 1 }], [{ variantId: "test-var-jelly-pink", quantity: 2 }]]) {
      expect((await startCheckout(lines)).ok).toBe(false);
    }
    expect(state.create).not.toHaveBeenCalled();
  });

  it("refuses the last unit to a second shopper while the first checkout is open", async () => {
    expect((await startCheckout([{ variantId: "test-var-jelly-pink", quantity: 1 }])).ok).toBe(true);
    const second = await startCheckout([{ variantId: "test-var-jelly-pink", quantity: 1 }]);
    expect(second).toEqual({ ok: false, error: expect.stringContaining("just sold out") });
  });

  it("releases the hold and shows a friendly error if Stripe fails", async () => {
    state.create = vi.fn(async () => {
      throw Object.assign(new Error("Invalid API Key provided: sk_test_****"), { type: "StripeAuthenticationError", code: "api_key_invalid" });
    });
    const r = await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Nothing was charged") });
    expect(await left("test-var-jelly-blue", 5)).toBe(5);
    // The log must not include Stripe's message (it can echo request details).
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain("sk_test");
  });

  it("refuses a session that Stripe reports as live", async () => {
    state.create = vi.fn(async () => ({ id: "cs_live_abc", livemode: true, url: "https://checkout.stripe.com/x" }));
    expect((await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }])).ok).toBe(false);
    expect(await left("test-var-jelly-blue", 5)).toBe(5);
  });

  it("is closed when the test switch is off, on production, or with a live key", async () => {
    for (const env of [{ STRIPE_TEST_CHECKOUT_ENABLED: "false" }, { BUILD_CONTEXT: "production" }, { STRIPE_TEST_SECRET_KEY: "sk_live_FAKE123" }]) {
      Object.assign(process.env, ENV, env);
      expect(await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
    }
    expect(state.create).not.toHaveBeenCalled();
  });

  it("cancel expires the open Stripe session and frees the stock", async () => {
    await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    const checkoutId = (state.create.mock.calls[0] as unknown as [{ client_reference_id: string }])[0].client_reference_id;
    await cancelTestCheckout(checkoutId);
    expect(state.expire).toHaveBeenCalledWith("cs_test_abcdefghij123");
    expect(await left("test-var-jelly-blue", 5)).toBe(5);
  });

  it("cancel never frees stock for a session that was already paid", async () => {
    await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    const checkoutId = (state.create.mock.calls[0] as unknown as [{ client_reference_id: string }])[0].client_reference_id;
    state.retrieve = vi.fn(async () => ({ status: "complete" }));
    await cancelTestCheckout(checkoutId);
    expect(state.expire).not.toHaveBeenCalled();
    expect(await left("test-var-jelly-blue", 5)).toBe(3);
  });
});
