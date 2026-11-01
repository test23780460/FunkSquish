import { describe, expect, it } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { orderKey } from "@/commerce/orders/fulfill";
import { cancellationEmail, notifyCanceled, notifyRefund, notifyTrackingUpdate, refundEmail, retryOtherEmails, trackingUpdateEmail, type NotifyConfig } from "@/commerce/orders/notify";
import type { Order } from "@/commerce/orders/types";
import { order } from "../owner/factory";

/* Fictional customers; a fake mailer — nothing is sent anywhere. */
function setup(over: Partial<Order> = {}, opts: { failFirst?: boolean; testMode?: boolean } = {}) {
  const store = new MemoryKvStore();
  const sent: { to: string; subject: string; tag: string }[] = [];
  let fail = !!opts.failFirst;
  const cfg: NotifyConfig = {
    mailer: {
      async send(m) {
        if (fail) {
          fail = false;
          return { ok: false, code: "brevo-500" };
        }
        sent.push(m);
        return { ok: true };
      },
    },
    ownerEmail: "owner@example.com",
    ownerOrdersUrl: "https://example.com/orders",
    sendInTestMode: !opts.testMode,
    siteUrl: "https://example.com",
    contactEmail: "hello@example.com",
  };
  const o = order({ mode: "test", ...over }, [{ id: "g1", status: "shipped", carrier: "USPS", trackingNumber: "9400100000000000000001", shippedAt: "2026-11-02T00:00:00Z" }]);
  return { store, sent, cfg, o, put: () => store.create(orderKey(o.stripeCheckoutSessionId), o) };
}

describe("cancellation, refund and tracking-update emails", () => {
  it("each event emails the customer exactly once, even if called again", async () => {
    const { store, sent, cfg, o, put } = setup({ refunds: [{ stripeRefundId: "re_1", amount: 1250, reason: null, createdAt: "2026-11-02T00:00:00Z", groupId: "g1" }] });
    await put();
    for (let i = 0; i < 3; i++) {
      await notifyCanceled(store, o, cfg);
      await notifyRefund(store, o, o.refunds[0], cfg);
      await notifyTrackingUpdate(store, o, "g1", cfg);
    }
    expect(sent.map((s) => s.tag).sort()).toEqual(["order-canceled", "order-refund", "order-tracking-update"]);
    expect(sent.every((s) => s.to === "fictional.buyer@example.com")).toBe(true);
  });

  it("a second refund and a new tracking number are new emails", async () => {
    const { store, sent, cfg, o, put } = setup();
    await put();
    await notifyRefund(store, o, { stripeRefundId: "re_1", amount: 100, reason: null, createdAt: "a", groupId: null }, cfg);
    await notifyRefund(store, o, { stripeRefundId: "re_2", amount: 200, reason: null, createdAt: "b", groupId: null }, cfg);
    await notifyTrackingUpdate(store, o, "g1", cfg);
    const changed = { ...o, fulfillments: [{ ...o.fulfillments[0], trackingNumber: "9400100000000000000002" }] };
    await notifyTrackingUpdate(store, changed, "g1", cfg);
    expect(sent.map((s) => s.tag)).toEqual(["order-refund", "order-refund", "order-tracking-update", "order-tracking-update"]);
  });

  it("test-mode orders are not emailed unless that's switched on", async () => {
    const { store, sent, cfg, o, put } = setup({}, { testMode: true });
    await put();
    await notifyCanceled(store, o, cfg);
    expect(sent).toEqual([]);
    expect((await store.get<Order>(orderKey(o.stripeCheckoutSessionId)))!.value.notifications?.other?.canceled).toMatchObject({ status: "skipped", code: "test-mode" });
  });

  it("a failed send is recorded and can be retried once", async () => {
    const { store, sent, cfg, o, put } = setup({}, { failFirst: true });
    await put();
    await notifyCanceled(store, o, cfg);
    const saved = (await store.get<Order>(orderKey(o.stripeCheckoutSessionId)))!.value;
    expect(saved.notifications?.other?.canceled).toMatchObject({ status: "failed", code: "brevo-500" });
    await retryOtherEmails(store, saved, cfg);
    await retryOtherEmails(store, saved, cfg);
    expect(sent.map((s) => s.tag)).toEqual(["order-canceled"]);
  });

  it("customer-provided text is escaped in emails", () => {
    const o = order({ lineItems: [{ ...order().lineItems[0], name: '<img src=x onerror="alert(1)">' }] });
    const cfg = { contactEmail: "hello@example.com" };
    expect(cancellationEmail(o, cfg).html).not.toMatch(/<img/);
    expect(cancellationEmail(o, cfg).html).toMatch(/&lt;img/);
    expect(refundEmail(o, { stripeRefundId: null, amount: 1, reason: null, createdAt: "x" }, cfg).subject).toMatch(o.id);
    expect(trackingUpdateEmail({ ...o, fulfillments: [{ ...o.fulfillments[0], trackingUrl: 'javascript:"x' }] }, o.fulfillments[0].id).html).not.toMatch(/href="javascript:"x/);
  });
});
