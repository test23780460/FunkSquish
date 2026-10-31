import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKvStore } from "@/commerce/orders/store";

// Fake values only — not real Stripe credentials.
const ENV = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
};

const state = { store: new MemoryKvStore(), retrieve: vi.fn() };

vi.mock("server-only", () => ({}));
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getTestOrderStore: async () => state.store }));
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeTestClient: () => ({ disputes: { retrieve: state.retrieve } }),
}));

const { orderDepsFor } = await import("@/commerce/checkout/service");
const { stripeTestConfig } = await import("@/commerce/checkout/environment");

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, ENV);
  state.store = new MemoryKvStore();
  state.retrieve = vi.fn();
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
});

const deps = async () => orderDepsFor(stripeTestConfig()!);

describe("reading a dispute's current state from Stripe (used only to settle conflicting events)", () => {
  it("returns status, amount and evidence deadline from the Dispute object", async () => {
    state.retrieve.mockResolvedValue({ id: "du_abc123def", livemode: false, status: "appeal_needs_response", amount: 2250, evidence_details: { due_by: 1762400000 } });
    const d = await deps();
    expect(await d.retrieveDispute!("du_abc123def")).toEqual({ status: "appeal_needs_response", amount: 2250, evidenceDueBy: new Date(1762400000 * 1000).toISOString() });
    expect(state.retrieve).toHaveBeenCalledWith("du_abc123def");
  });

  it("refuses a dispute from the other Stripe mode (test and live stay separate)", async () => {
    state.retrieve.mockResolvedValue({ id: "du_abc123def", livemode: true, status: "won", amount: 2250, evidence_details: { due_by: null } });
    await expect((await deps()).retrieveDispute!("du_abc123def")).rejects.toThrow(/other Stripe mode/);
  });

  it("never sends something that isn't a dispute id to Stripe", async () => {
    await expect((await deps()).retrieveDispute!("../charges/ch_1")).rejects.toThrow(/Not a Stripe dispute id/);
    expect(state.retrieve).not.toHaveBeenCalled();
  });
});
