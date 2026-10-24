import { describe, expect, it } from "vitest";
import { fulfillCheckoutSession, getOrderBySession, markPaymentFailed, orderNumberFor, recordRefund } from "@/commerce/orders/fulfill";
import { availableUnits, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import { CHECKOUT_ID, SESSION_ID, fakeDeps, snapshot } from "./helpers";

const NOW = Math.floor(new Date("2026-10-24T12:00:00Z").getTime() / 1000);

async function holdStock(f: ReturnType<typeof fakeDeps>) {
  await reserveStock(
    f.store,
    CHECKOUT_ID,
    [
      { variantId: "test-var-jelly-blue", quantity: 2, onHand: 5 },
      { variantId: "test-var-supplier-mint", quantity: 1, onHand: 3 },
    ],
    NOW + 1860,
    NOW - 60,
  );
}

async function stockLeft(f: ReturnType<typeof fakeDeps>, variantId: string, onHand: number) {
  const ledger = (await f.store.get<VariantLedger>(`stock/${variantId}`))?.value ?? null;
  return availableUnits(onHand, ledger, NOW + 100_000); // far future: only sold units count
}

describe("fulfillCheckoutSession", () => {
  it("creates one paid order from a verified paid session", async () => {
    const f = fakeDeps();
    await holdStock(f);
    const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(r.state).toBe("paid");
    if (r.state !== "paid") return;
    expect(r.order).toMatchObject({
      id: orderNumberFor(SESSION_ID, new Date("2026-10-24T12:00:00Z")),
      mode: "test",
      status: "open",
      paymentStatus: "paid",
      inventoryCommitted: true,
      flags: [],
      amounts: { currency: "usd", total: 2250, shipping: 500 },
    });
    expect(r.order.id).toMatch(/^FS-T-20261024-[0-9A-F]{8}$/);
    expect(await stockLeft(f, "test-var-jelly-blue", 5)).toBe(3);
  });

  it("splits fulfillment between our stock and the supplier (manual)", async () => {
    const f = fakeDeps();
    const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    if (r.state !== "paid") throw new Error("expected paid");
    expect(r.order.fulfillments).toEqual([
      expect.objectContaining({ source: "in_house", status: "unfulfilled", variantIds: ["test-var-jelly-blue"] }),
      expect.objectContaining({ source: "supplier", status: "awaiting_supplier", variantIds: ["test-var-supplier-mint"], supplierRef: null }),
    ]);
  });

  it("does NOT create an order for an unpaid / abandoned session (redirect is not proof)", async () => {
    const f = fakeDeps(snapshot({ status: "open", paymentStatus: "unpaid" }));
    expect(await fulfillCheckoutSession(SESSION_ID, f.deps, "landing-page", "landing-page")).toEqual({ state: "not_paid", sessionStatus: "open" });
    expect(await getOrderBySession(f.store, SESSION_ID)).toBe(null);
  });

  it("does NOT create an order for an expired session", async () => {
    const f = fakeDeps(snapshot({ status: "expired", paymentStatus: "unpaid" }));
    expect((await fulfillCheckoutSession(SESSION_ID, f.deps, "x", "x")).state).toBe("not_paid");
  });

  it("rejects malformed or live session ids without calling Stripe", async () => {
    const f = fakeDeps();
    for (const id of ["cs_live_a1B2c3D4e5F6g7H8", "pi_123", "../../etc", ""]) {
      expect(await fulfillCheckoutSession(id, f.deps, "x", "x")).toEqual({ state: "invalid" });
    }
    expect(f.retrieveCalls).toBe(0);
  });

  it("refuses a session Stripe reports as live mode", async () => {
    const f = fakeDeps(snapshot({ livemode: true }));
    expect(await fulfillCheckoutSession(SESSION_ID, f.deps, "x", "x")).toEqual({ state: "invalid" });
  });

  it("is idempotent: repeated and concurrent calls make one order and commit stock once", async () => {
    const f = fakeDeps();
    await holdStock(f);
    const results = await Promise.all([
      fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed"),
      fulfillCheckoutSession(SESSION_ID, f.deps, "landing-page", "landing-page"),
      fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed"),
    ]);
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    const ids = new Set(results.map((r) => (r.state === "paid" ? r.order.id : null)));
    expect(ids.size).toBe(1);
    expect(f.store.keys().filter((k) => k.startsWith("order/session/"))).toHaveLength(1);
    expect(await stockLeft(f, "test-var-jelly-blue", 5)).toBe(3);
    expect(await stockLeft(f, "test-var-supplier-mint", 3)).toBe(2);
  });

  it("handles delayed payment methods: processing first, then paid", async () => {
    const f = fakeDeps(snapshot({ status: "complete", paymentStatus: "unpaid" }));
    await holdStock(f);
    const first = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(first.state).toBe("processing");
    expect(await stockLeft(f, "test-var-jelly-blue", 5)).toBe(5); // not sold yet
    f.setSession({ paymentStatus: "paid" });
    const second = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_2", "checkout.session.async_payment_succeeded");
    expect(second.state).toBe("paid");
    if (second.state === "paid") expect(second.order.history.map((h) => h.type)).toEqual(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
    expect(await stockLeft(f, "test-var-jelly-blue", 5)).toBe(3);
  });

  it("cancels the order and frees stock when a delayed payment fails", async () => {
    const f = fakeDeps(snapshot({ status: "complete", paymentStatus: "unpaid" }));
    await holdStock(f);
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    await markPaymentFailed(SESSION_ID, CHECKOUT_ID, f.deps, "evt_3");
    const order = await getOrderBySession(f.store, SESSION_ID);
    expect(order).toMatchObject({ paymentStatus: "failed", status: "canceled" });
    const ledger = (await f.store.get<VariantLedger>("stock/test-var-jelly-blue"))?.value ?? null;
    expect(availableUnits(5, ledger, NOW)).toBe(5);
  });

  it("never marks a paid order as failed", async () => {
    const f = fakeDeps();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    await markPaymentFailed(SESSION_ID, CHECKOUT_ID, f.deps, "evt_3");
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "paid", status: "open" });
  });

  it("records partial and full refunds once each", async () => {
    const f = fakeDeps();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(await recordRefund("pi_test_123", 500, f.deps, "evt_r1")).toBe(true);
    await recordRefund("pi_test_123", 500, f.deps, "evt_r1"); // duplicate delivery
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "partially_refunded", refunds: [expect.objectContaining({ amount: 500 })] });
    await recordRefund("pi_test_123", 2250, f.deps, "evt_r2");
    const order = await getOrderBySession(f.store, SESSION_ID);
    expect(order?.paymentStatus).toBe("refunded");
    expect(order?.status).toBe("canceled");
    expect(order?.refunds.map((r) => r.amount)).toEqual([500, 1750]);
  });

  it("ignores refunds for unknown payments", async () => {
    const f = fakeDeps();
    expect(await recordRefund("pi_test_unknown", 100, f.deps, "evt")).toBe(false);
  });
});

describe("after a refund", () => {
  it("still reports the order as paid (not processing) and keeps one order", async () => {
    const f = fakeDeps();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    await recordRefund("pi_test_123", 2250, f.deps, "evt_r");
    const again = await fulfillCheckoutSession(SESSION_ID, f.deps, "landing-page", "landing-page");
    expect(again.state).toBe("paid");
    if (again.state === "paid") expect(again.order.paymentStatus).toBe("refunded");
    expect(f.store.keys().filter((k) => k.startsWith("order/session/"))).toHaveLength(1);
  });
});
