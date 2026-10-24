import { describe, expect, it } from "vitest";
import { handleStripeEvent, type VerifiedEvent } from "@/commerce/orders/webhook";
import { getOrderBySession } from "@/commerce/orders/fulfill";
import { availableUnits, getReservation, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import { CHECKOUT_ID, SESSION_ID, fakeDeps, snapshot } from "./helpers";

const ev = (id: string, type: string, object: Record<string, unknown> = { id: SESSION_ID, client_reference_id: CHECKOUT_ID }, livemode = false): VerifiedEvent => ({
  id,
  type,
  livemode,
  data: { object },
});

describe("handleStripeEvent", () => {
  it("creates the order on checkout.session.completed", async () => {
    const f = fakeDeps();
    expect(await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps)).toEqual({ status: "processed" });
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "paid" });
  });

  it("skips an event id it has already processed", async () => {
    const f = fakeDeps();
    await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps);
    const calls = f.retrieveCalls;
    expect(await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps)).toEqual({ status: "duplicate" });
    expect(f.retrieveCalls).toBe(calls);
  });

  it("stays safe when Stripe sends two different events for the same session", async () => {
    const f = fakeDeps();
    await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps);
    await handleStripeEvent(ev("evt_2", "checkout.session.completed"), f.deps);
    expect(f.store.keys().filter((k) => k.startsWith("order/session/"))).toHaveLength(1);
  });

  it("rejects live-mode events", async () => {
    const f = fakeDeps();
    await expect(handleStripeEvent(ev("evt_1", "checkout.session.completed", undefined, true), f.deps)).rejects.toThrow();
  });

  it("ignores event types it doesn't handle", async () => {
    const f = fakeDeps();
    expect(await handleStripeEvent(ev("evt_9", "customer.created"), f.deps)).toEqual({ status: "ignored" });
    expect(f.store.keys()).toEqual([]);
  });

  it("releases held stock when a session expires (canceled / abandoned checkout)", async () => {
    const f = fakeDeps(snapshot({ status: "expired", paymentStatus: "unpaid" }));
    const now = Math.floor(Date.now() / 1000);
    await reserveStock(f.store, CHECKOUT_ID, [{ variantId: "test-var-jelly-blue", quantity: 3, onHand: 5 }], now + 1860, now);
    await handleStripeEvent(ev("evt_x", "checkout.session.expired"), f.deps);
    expect((await getReservation(f.store, CHECKOUT_ID))?.status).toBe("released");
    const ledger = (await f.store.get<VariantLedger>("stock/test-var-jelly-blue"))?.value ?? null;
    expect(availableUnits(5, ledger, now)).toBe(5);
  });

  it("marks async payment failures", async () => {
    const f = fakeDeps(snapshot({ paymentStatus: "unpaid" }));
    await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps);
    await handleStripeEvent(ev("evt_2", "checkout.session.async_payment_failed"), f.deps);
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "failed", status: "canceled" });
  });

  it("records refunds from charge.refunded", async () => {
    const f = fakeDeps();
    await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps);
    await handleStripeEvent(ev("evt_r", "charge.refunded", { id: "ch_1", payment_intent: "pi_test_123", amount_refunded: 2250 }), f.deps);
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "refunded" });
  });

  it("lets a failed attempt be retried (Stripe redelivers after a 5xx)", async () => {
    const f = fakeDeps();
    const broken = { ...f.deps, retrieveSession: async () => Promise.reject(new Error("Stripe unreachable")) };
    await expect(handleStripeEvent(ev("evt_1", "checkout.session.completed"), broken)).rejects.toThrow();
    expect(await handleStripeEvent(ev("evt_1", "checkout.session.completed"), f.deps)).toEqual({ status: "processed" });
    expect(await getOrderBySession(f.store, SESSION_ID)).toMatchObject({ paymentStatus: "paid" });
  });
});
