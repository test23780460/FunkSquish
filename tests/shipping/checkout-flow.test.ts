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
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
});

type Params = { shipping_options: { shipping_rate_data: { fixed_amount: { amount: number }; display_name: string } }[]; metadata: Record<string, string>; custom_text: { shipping_address: { message: string } } };
const sentParams = () => state.create.mock.calls[0][0] as unknown as Params;
const held = async (v: string, onHand: number) => availableUnits(onHand, (await state.store.get<VariantLedger>(`stock/${v}`))?.value ?? null, Math.floor(Date.now() / 1000));

describe("checkout with cart-dependent shipping (Stripe test mode)", () => {
  it("single origin: one package, priced by the server", async () => {
    expect((await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 2 }])).ok).toBe(true);
    const p = sentParams();
    expect(p.shipping_options).toHaveLength(1);
    expect(p.shipping_options[0].shipping_rate_data).toMatchObject({ display_name: "Shipping", fixed_amount: { amount: 650 } });
    expect(p.metadata.shipping_plan).toBe("v1;test-studio:h:650:2:1");
  });

  it("supplier-only: two suppliers, two packages, one combined charge", async () => {
    expect((await startCheckout([{ variantId: "test-var-supplier-mint", quantity: 2 }, { variantId: "test-var-supplierb-peach", quantity: 1 }])).ok).toBe(true);
    const p = sentParams();
    expect(p.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(599 + 150 + 700);
    expect(p.custom_text.shipping_address.message).toMatch(/2 separate packages/);
  });

  it("mixed: the cart quote and Stripe's session show the same shipping", async () => {
    const lines = [
      { variantId: "test-var-jelly-blue", quantity: 1 },
      { variantId: "test-var-supplier-mint", quantity: 1 },
      { variantId: "test-var-supplierb-peach", quantity: 2 },
    ];
    const q = await quoteCheckout(lines);
    expect(q).toEqual({
      ok: true,
      subtotal: 500 + 750 + 1300,
      shipping: 450 + 599 + 700,
      totalBeforeTax: 2550 + 1749,
      packages: [
        { label: "FunkSquish (test)", units: 1, cents: 450, shipsWithinBusinessDays: 2 },
        { label: "test supplier partner A", units: 1, cents: 599, shipsWithinBusinessDays: 3 },
        { label: "test supplier partner B", units: 2, cents: 700, shipsWithinBusinessDays: 5 },
      ],
    });
    expect((await startCheckout(lines)).ok).toBe(true);
    expect(sentParams().shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(q.ok ? q.shipping : -1);
    expect(sentParams().custom_text.shipping_address.message).toMatch(/can't be sent to APO\/FPO\/DPO/);
  });

  it("refuses an item without verified shipping before holding stock or contacting Stripe", async () => {
    const r = await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }, { variantId: "test-var-unrated-lime", quantity: 1 }]);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/^Shipping for TEST Unrated-Supplier Squish .* isn't set up yet/) });
    expect(state.create).not.toHaveBeenCalled();
    expect(await held("test-var-jelly-blue", 5)).toBe(5);
    const q = await quoteCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }, { variantId: "test-var-unrated-lime", quantity: 1 }]);
    expect(q).toMatchObject({ ok: false, blocked: [{ variantId: "test-var-unrated-lime" }] });
  });

  it("refuses a package too big for its origin's largest verified tier", async () => {
    const r = await startCheckout([{ variantId: "test-var-supplierb-peach", quantity: 4 }]);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("won't fit in one package") });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("ignores any shipping amount the browser sends", async () => {
    const r = await startCheckout([{ variantId: "test-var-jelly-blue", quantity: 1, shipping: 0, shippingCents: 1 } as unknown as { variantId: string; quantity: number }]);
    expect(r.ok).toBe(true);
    expect(sentParams().shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(450);
  });

  it("the quote is closed wherever checkout is closed", async () => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect(await quoteCheckout([{ variantId: "test-var-jelly-blue", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet.", blocked: [] });
  });
});
