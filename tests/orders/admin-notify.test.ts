import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey } from "@/commerce/orders/fulfill";
import { notifyPaidOrder, notifyShipped, ownerOrderEmail, customerConfirmationEmail, type Mailer, type NotifyConfig } from "@/commerce/orders/notify";
import { cancelOrder, getOrder, listOrders, markShipped, reconcileRecentSessions, refundOrder } from "@/commerce/orders/admin";
import { availableUnits, type VariantLedger } from "@/commerce/orders/inventory";
import type { Order } from "@/commerce/orders/types";
import { fakeDeps, snapshot, SESSION_ID, CHECKOUT_ID } from "./helpers";

function mailer() {
  const sent: { to: string; subject: string; html: string }[] = [];
  const m: Mailer & { sent: typeof sent; fail: boolean } = {
    sent,
    fail: false,
    async send(msg) {
      if (m.fail) return { ok: false, code: "brevo-500" };
      sent.push(msg);
      return { ok: true };
    },
  };
  return m;
}
const cfg = (m: Mailer | null, sendInTestMode = true): NotifyConfig => ({
  mailer: m,
  ownerEmail: "owner@funksquish.example",
  ownerOrdersUrl: "https://preview.example/partners/review/orders",
  sendInTestMode,
  siteUrl: "https://funksquish.com",
  contactEmail: "travis@funksquish.example",
});

async function paidOrder() {
  const f = fakeDeps();
  const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
  if (r.state !== "paid") throw new Error("not paid");
  return { f, order: r.order };
}
const reload = async (f: ReturnType<typeof fakeDeps>) => (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;

describe("order emails", () => {
  it("sends the confirmation and the owner alert exactly once, even when called concurrently", async () => {
    const { f, order } = await paidOrder();
    const m = mailer();
    await Promise.all([notifyPaidOrder(f.store, order, cfg(m)), notifyPaidOrder(f.store, order, cfg(m)), notifyPaidOrder(f.store, order, cfg(m))]);
    expect(m.sent.map((s) => s.to).sort()).toEqual(["buyer@example.com", "owner@funksquish.example"]);
    const stored = await reload(f);
    expect(stored.notifications?.customer?.status).toBe("sent");
    expect(stored.notifications?.owner?.status).toBe("sent");
  });

  it("is wired into order processing (webhook, retries and the success page all call it)", async () => {
    const f = fakeDeps();
    const m = mailer();
    f.deps.afterPaid = (order) => notifyPaidOrder(f.store, order, cfg(m));
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    await fulfillCheckoutSession(SESSION_ID, f.deps, "landing-page", "landing-page");
    expect(m.sent).toHaveLength(2);
  });

  it("skips test-mode emails unless switched on, and lets failed ones be retried", async () => {
    const { f, order } = await paidOrder();
    const m = mailer();
    await notifyPaidOrder(f.store, order, cfg(m, false));
    expect(m.sent).toHaveLength(0);
    expect((await reload(f)).notifications?.customer).toMatchObject({ status: "skipped", code: "test-mode" });

    const g = await paidOrder();
    const bad = mailer();
    bad.fail = true;
    await notifyPaidOrder(g.f.store, g.order, cfg(bad));
    expect((await reload(g.f)).notifications?.customer).toMatchObject({ status: "failed", code: "brevo-500" });
    bad.fail = false;
    await notifyPaidOrder(g.f.store, await reload(g.f), cfg(bad));
    expect(bad.sent).toHaveLength(2);
  });

  it("keeps customer details out of the owner email and escapes everything", async () => {
    const { order } = await paidOrder();
    const owner = ownerOrderEmail(order, "https://x");
    expect(owner.html).not.toContain("buyer@example.com");
    expect(owner.html).not.toContain("1 Test St");
    const evil = { ...order, customer: { ...order.customer, name: "<script>x</script>" } };
    expect(customerConfirmationEmail(evil, cfg(null)).html).not.toContain("<script>");
    expect(customerConfirmationEmail(order, cfg(null)).subject).toMatch(/^\[TEST\] /);
  });
});

describe("owner order management", () => {
  it("marks a package shipped with valid tracking, then emails the customer once", async () => {
    const { f } = await paidOrder();
    expect(await markShipped(f.store, SESSION_ID, "in_house-1", { carrier: "USPS", trackingNumber: "bad #", trackingUrl: "" })).toMatchObject({ ok: false });
    expect(await markShipped(f.store, SESSION_ID, "in_house-1", { carrier: "USPS", trackingNumber: "9400111899223", trackingUrl: "http://insecure" })).toMatchObject({ ok: false });
    const r = await markShipped(f.store, SESSION_ID, "in_house-1", { carrier: "USPS", trackingNumber: "9400 1118 9922 3", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223" });
    expect(r.ok && r.order.status).toBe("partially_fulfilled");
    const m = mailer();
    await notifyShipped(f.store, r.ok ? r.order : (null as never), "in_house-1", cfg(m));
    await notifyShipped(f.store, r.ok ? r.order : (null as never), "in_house-1", cfg(m));
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0].html).toContain("9400111899223");
  });

  it("refunds through Stripe once per click, never more than was paid", async () => {
    const { f } = await paidOrder();
    const create = vi.fn(async (params: Stripe.RefundCreateParams, opts: Stripe.RequestOptions) => ({ id: `re_${opts.idempotencyKey}`, amount: params.amount }));
    const stripe = { refunds: { create } } as unknown as Stripe;
    expect(await refundOrder(stripe, f.store, SESSION_ID, 999_999)).toMatchObject({ ok: false });
    const r = await refundOrder(stripe, f.store, SESSION_ID, 500);
    expect(r.ok && r.order.paymentStatus).toBe("partially_refunded");
    expect(create.mock.calls[0][1].idempotencyKey).toMatch(/^funksquish-refund-FS-T-.*-0-500$/);
    const again = await refundOrder(stripe, f.store, SESSION_ID, 1750);
    expect(again.ok && again.order.paymentStatus).toBe("refunded");
    expect(await refundOrder(stripe, f.store, SESSION_ID, 1)).toMatchObject({ ok: false });
  });

  it("cancels an unshipped order: refunds the rest and puts the units back", async () => {
    const { f } = await paidOrder();
    const stripe = { refunds: { create: vi.fn(async (p: Stripe.RefundCreateParams) => ({ id: "re_1", amount: p.amount })) } } as unknown as Stripe;
    const ledgerBefore = (await f.store.get<VariantLedger>("stock/test-var-jelly-blue"))?.value ?? null;
    expect(availableUnits(5, ledgerBefore, 0)).toBe(3);
    const r = await cancelOrder(stripe, f.store, SESSION_ID);
    expect(r.ok && r.order.status).toBe("canceled");
    expect(r.ok && r.order.paymentStatus).toBe("refunded");
    const ledgerAfter = (await f.store.get<VariantLedger>("stock/test-var-jelly-blue"))?.value ?? null;
    expect(availableUnits(5, ledgerAfter, 0)).toBe(5);
    expect((await getOrder(f.store, SESSION_ID))?.status).toBe("canceled");
  });

  it("won't cancel once something shipped", async () => {
    const { f } = await paidOrder();
    await markShipped(f.store, SESSION_ID, "in_house-1", { carrier: "USPS", trackingNumber: "9400111899223", trackingUrl: "" });
    const stripe = { refunds: { create: vi.fn() } } as unknown as Stripe;
    expect(await cancelOrder(stripe, f.store, SESSION_ID)).toMatchObject({ ok: false });
  });

  it("recovers paid checkouts whose webhook never arrived", async () => {
    const f = fakeDeps();
    const stripe = {
      checkout: {
        sessions: {
          list: () =>
            (async function* () {
              yield { id: SESSION_ID };
            })(),
        },
      },
    } as unknown as Stripe;
    expect(await reconcileRecentSessions(stripe, f.deps)).toEqual({ checked: 1, recorded: 1 });
    expect(await reconcileRecentSessions(stripe, f.deps)).toEqual({ checked: 1, recorded: 0 });
    expect(await listOrders(f.store)).toHaveLength(1);
    expect((await listOrders(f.store))[0].checkoutId).toBe(CHECKOUT_ID);
    expect(snapshot().id).toBe(SESSION_ID);
  });
});
