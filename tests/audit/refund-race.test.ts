import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey, recordRefund } from "@/commerce/orders/fulfill";
import { refundOrder, refundedSoFar } from "@/commerce/orders/admin";
import type { Order } from "@/commerce/orders/types";
import { fakeDeps, SESSION_ID } from "../orders/helpers";

/**
 * Audit finding X-03: Stripe's charge.refunded webhook can arrive while the
 * owner's refund is still being saved. Both paths must agree on one refund.
 */
describe("refund recorded by the owner page and by the webhook at the same time", () => {
  it("is counted once when the webhook lands between Stripe's reply and our save", async () => {
    const f = fakeDeps();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    const stripe = {
      refunds: {
        create: async (p: Stripe.RefundCreateParams) => {
          // Stripe has created the refund and its webhook is processed before refundOrder saves.
          await recordRefund("pi_test_123", p.amount!, f.deps, "evt_refund");
          return { id: "re_race", amount: p.amount };
        },
      },
    } as unknown as Stripe;
    const r = await refundOrder(stripe, f.store, SESSION_ID, 500);
    expect(r.ok).toBe(true);
    const order = (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;
    expect(refundedSoFar(order)).toBe(500);
    expect(order.paymentStatus).toBe("partially_refunded");
    expect(order.refunds).toHaveLength(1);
    expect(order.refunds[0].stripeRefundId).toBe("re_race");
  });

  it("a later webhook for the same refund adds nothing", async () => {
    const f = fakeDeps();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    const stripe = { refunds: { create: async (p: Stripe.RefundCreateParams) => ({ id: "re_1", amount: p.amount }) } } as unknown as Stripe;
    await refundOrder(stripe, f.store, SESSION_ID, 500);
    await recordRefund("pi_test_123", 500, f.deps, "evt_refund");
    const order = (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;
    expect(refundedSoFar(order)).toBe(500);
  });
});
