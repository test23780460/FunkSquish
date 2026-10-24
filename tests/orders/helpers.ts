import { MemoryKvStore } from "@/commerce/orders/store";
import type { OrderDeps } from "@/commerce/orders/fulfill";
import type { SessionSnapshot } from "@/commerce/orders/session-snapshot";

export const SESSION_ID = "cs_test_a1B2c3D4e5F6g7H8";
export const CHECKOUT_ID = "11111111-2222-3333-4444-555555555555";

export function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: SESSION_ID,
    livemode: false,
    status: "complete",
    paymentStatus: "paid",
    checkoutId: CHECKOUT_ID,
    paymentIntentId: "pi_test_123",
    amounts: { subtotal: 1750, shipping: 500, tax: 0, discount: 0, total: 2250 },
    customer: { email: "buyer@example.com", name: "Test Buyer", phone: null },
    shippingAddress: { name: "Test Buyer", line1: "1 Test St", line2: null, city: "Testville", state: "KY", postalCode: "40000", country: "US" },
    shippingRateId: "shr_FAKE",
    lineItems: [
      { variantId: "test-var-jelly-blue", productId: "p1", sku: "TEST-JELLY-BLUE", name: "Blue", quantity: 2, unitAmount: 500, amountTotal: 1000, fulfillmentSource: "in_house" },
      { variantId: "test-var-supplier-mint", productId: "p2", sku: "TEST-SUPPLIER-MINT", name: "Mint", quantity: 1, unitAmount: 750, amountTotal: 750, fulfillmentSource: "supplier" },
    ],
    ...overrides,
  };
}

/** Deps with a fake Stripe whose session state the test can change. */
export function fakeDeps(initial: SessionSnapshot = snapshot()) {
  const store = new MemoryKvStore();
  let current = initial;
  let retrieveCalls = 0;
  const deps: OrderDeps = {
    store,
    async retrieveSession(id) {
      retrieveCalls++;
      if (id !== current.id) throw new Error("No such checkout session");
      return current;
    },
    onHand: (variantId) => ({ "test-var-jelly-blue": 5, "test-var-supplier-mint": 3 })[variantId] ?? 0,
    now: () => new Date("2026-10-24T12:00:00Z"),
  };
  return {
    deps,
    store,
    setSession(next: Partial<SessionSnapshot>) {
      current = { ...current, ...next };
    },
    get retrieveCalls() {
      return retrieveCalls;
    },
  };
}
