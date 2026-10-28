import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey, recordRefund } from "@/commerce/orders/fulfill";
import {
  allocate,
  cancelOrder,
  cancelPackage,
  markLost,
  markReturned,
  markShipped,
  orderAttention,
  packageAmounts,
  refundOrder,
  refundPackage,
  refundedSoFar,
  reshipPackage,
  returnedRefundDeadline,
  sendDelayNotice,
} from "@/commerce/orders/admin";
import { customerConfirmationEmail, notifyShipped, shippingEmail, type Mailer, type NotifyConfig } from "@/commerce/orders/notify";
import { availableUnits, commitStock, type VariantLedger } from "@/commerce/orders/inventory";
import type { SessionSnapshot } from "@/commerce/orders/session-snapshot";
import type { Order } from "@/commerce/orders/types";
import { signatureRecommended, SIGNATURE_POLICY } from "@/commerce/signature";
import { fakeDeps, snapshot, SESSION_ID, CHECKOUT_ID } from "../orders/helpers";

/**
 * A mixed order: 2 × Jelly from our studio, 1 × Mint from supplier A, 1 × Peach
 * from supplier B. Paid Saturday 2026-10-24 (Eastern), so business days start Monday.
 * Made-up test amounts; tax on, to check per-package refunds include tax.
 */
const mixed = (over: Partial<SessionSnapshot> = {}): SessionSnapshot =>
  snapshot({
    amounts: { subtotal: 2400, shipping: 1949, tax: 300, discount: 0, total: 4649, shippingTax: 117 },
    shippingPlan: [
      { groupId: "test-studio", source: "in_house", cents: 650, processingBusinessDays: 2, militaryAddresses: true },
      { groupId: "test-supplier-a", source: "supplier", cents: 599, processingBusinessDays: 3, militaryAddresses: false },
      { groupId: "test-supplier-b", source: "supplier", cents: 700, processingBusinessDays: 5, militaryAddresses: true },
    ],
    lineItems: [
      { variantId: "test-var-jelly-blue", productId: "p1", sku: "TEST-JELLY-BLUE", name: "Blue", quantity: 2, unitAmount: 500, amountTotal: 1060, amountTax: 60, fulfillmentSource: "in_house", fulfillmentOrigin: "test-studio" },
      { variantId: "test-var-supplier-mint", productId: "p2", sku: "TEST-SUPPLIER-MINT", name: "Mint", quantity: 1, unitAmount: 750, amountTotal: 795, amountTax: 45, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-a" },
      { variantId: "test-var-supplierb-peach", productId: "p3", sku: "TEST-SUPPLIERB-PEACH", name: "Peach", quantity: 1, unitAmount: 650, amountTotal: 728, amountTax: 78, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-b" },
    ],
    ...over,
  });
// Line totals include their tax (Stripe's amount_total): 1060 + 795 + 728 = 2583; + shipping 1949 + shipping tax 117 = 4649.

function fakeStripe() {
  const calls: { params: Stripe.RefundCreateParams; key: string }[] = [];
  const stripe = {
    refunds: {
      create: vi.fn(async (params: Stripe.RefundCreateParams, opts: { idempotencyKey: string }) => {
        calls.push({ params, key: opts.idempotencyKey });
        return { id: `re_${calls.length}`, amount: params.amount };
      }),
    },
  } as unknown as Stripe;
  return { stripe, calls };
}

async function paidMixed(over: Partial<SessionSnapshot> = {}) {
  const f = fakeDeps(mixed(over));
  f.deps.onHand = (v) => ({ "test-var-jelly-blue": 5, "test-var-supplier-mint": 3, "test-var-supplierb-peach": 4 })[v] ?? 0;
  const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
  if (r.state !== "paid") throw new Error("not paid");
  return f;
}
const reload = async (f: { store: { get<T>(k: string): Promise<{ value: T } | null> } }) => (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;
const g = (o: Order, id: string) => o.fulfillments.find((x) => x.id === id)!;

describe("a mixed order becomes one package per origin", () => {
  it("records each package's shipping charge, processing time and its own ship-by date", async () => {
    const o = await reload(await paidMixed());
    expect(o.fulfillments.map((x) => [x.id, x.source, x.shippingAmount, x.shipBy, x.status])).toEqual([
      ["test-studio", "in_house", 650, "2026-10-27", "unfulfilled"],
      ["test-supplier-a", "supplier", 599, "2026-10-28", "awaiting_supplier"],
      ["test-supplier-b", "supplier", 700, "2026-10-30", "awaiting_supplier"],
    ]);
    expect(g(o, "test-supplier-a").variantIds).toEqual(["test-var-supplier-mint"]);
    expect(o.flags).toEqual([]);
    // Supplier ship-by dates come from their written commitments, so nothing is left for the owner to guess.
    expect(orderAttention(o, new Date("2026-10-25T12:00:00Z")).map((a) => a.code)).not.toContain("set-ship-by");
  });

  it("flags the order if the package charges don't add up to what Stripe charged", async () => {
    const o = await reload(await paidMixed({ amounts: { subtotal: 2400, shipping: 1000, tax: 0, discount: 0, total: 3400 } }));
    expect(o.flags).toContain("shipping_mismatch");
    expect(orderAttention(o).map((a) => a.code)).toContain("shipping_mismatch");
  });

  it("falls back to one package per source (flagged) if the plan is missing", async () => {
    const o = await reload(await paidMixed({ shippingPlan: null }));
    expect(o.fulfillments.map((x) => x.id)).toEqual(["in_house-1", "supplier-1"]);
    expect(o.flags).toContain("shipping_mismatch");
    expect(packageAmounts(o, "in_house-1")).toBeNull(); // no per-package price is invented
  });

  it("keeps orders from before per-package pricing working exactly as before", async () => {
    const f = fakeDeps(); // old snapshot: no plan, no origins
    const r = await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect(r.state === "paid" && r.order.fulfillments.map((x) => x.id)).toEqual(["in_house-1", "supplier-1"]);
    expect(r.state === "paid" && r.order.flags).toEqual([]);
  });

  it("flags a military address when one package's origin can't ship there", async () => {
    const military = { name: "Test Buyer", line1: "PSC 1234 Box 5678", line2: null, city: "APO", state: "AE", postalCode: "09012", country: "US" };
    const o = await reload(await paidMixed({ shippingAddress: military }));
    expect(o.flags).toContain("military_unsupported");
    const plain = await reload(await paidMixed({ shippingAddress: military, shippingPlan: mixed().shippingPlan!.filter((p) => p.militaryAddresses), lineItems: mixed().lineItems.filter((l) => l.fulfillmentOrigin !== "test-supplier-a"), amounts: { subtotal: 1650, shipping: 1350, tax: 0, discount: 0, total: 3000 } }));
    expect(plain.flags).not.toContain("military_unsupported");
  });
});

describe("what each package cost", () => {
  it("splits the tax on shipping across packages to the cent", () => {
    expect(allocate(117, { a: 650, b: 599, c: 700 })).toEqual({ a: 39, b: 36, c: 42 });
    expect(Object.values(allocate(100, { a: 1, b: 1, c: 1 })).reduce((s, n) => s + n, 0)).toBe(100);
    expect(allocate(0, { a: 1 })).toEqual({ a: 0 });
  });

  it("package totals add up to the order total", async () => {
    const o = await reload(await paidMixed());
    const totals = o.fulfillments.map((x) => packageAmounts(o, x.id)!);
    expect(totals.map((t) => t.total)).toEqual([1060 + 650 + 39, 795 + 599 + 36, 728 + 700 + 42]);
    expect(totals.reduce((s, t) => s + t.total, 0)).toBe(o.amounts.total);
  });
});

describe("one package delayed or canceled", () => {
  it("a delay notice covers only that package; the others keep their dates", async () => {
    const f = await paidMixed();
    const r = await sendDelayNotice(f.store, SESSION_ID, "test-supplier-b", "2026-11-06", { mailer: null, ownerEmail: null, ownerOrdersUrl: "", sendInTestMode: false, siteUrl: "https://funksquish.com", contactEmail: "x@example.com" }, new Date("2026-10-28T12:00:00Z"));
    expect(r.ok).toBe(true);
    const o = await reload(f);
    expect(g(o, "test-supplier-b").shipBy).toBe("2026-11-06");
    expect(g(o, "test-studio").shipBy).toBe("2026-10-27");
    expect(g(o, "test-supplier-a").delayNotices).toEqual([]);
  });

  it("canceling one unshipped package refunds exactly its items, shipping and tax, and returns only its stock", async () => {
    const f = await paidMixed();
    const { stripe, calls } = fakeStripe();
    const ledger = async (v: string, onHand: number) => availableUnits(onHand, (await f.store.get<VariantLedger>(`stock/${v}`))?.value ?? null, 1_900_000_000);
    expect(await ledger("test-var-supplierb-peach", 4)).toBe(3);
    const r = await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-b");
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toMatchObject({ amount: 728 + 700 + 42, payment_intent: "pi_test_123", metadata: { package: "test-supplier-b" } });
    expect(calls[0].key).toMatch(/-test-supplier-b$/);
    const o = await reload(f);
    expect(g(o, "test-supplier-b")).toMatchObject({ status: "canceled" });
    expect(o.refunds).toEqual([expect.objectContaining({ amount: 1470, groupId: "test-supplier-b" })]);
    expect(o.status).toBe("open"); // the rest still ships
    expect(o.paymentStatus).toBe("partially_refunded");
    expect(await ledger("test-var-supplierb-peach", 4)).toBe(4); // its stock is back
    expect(await ledger("test-var-jelly-blue", 5)).toBe(3); // others untouched
  });

  it("the webhook for that refund doesn't count it twice", async () => {
    const f = await paidMixed();
    const { stripe } = fakeStripe();
    await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-b");
    await recordRefund("pi_test_123", 1470, f.deps, "evt_refund");
    expect(refundedSoFar(await reload(f))).toBe(1470);
  });

  it("won't cancel a shipped package, and asks for confirmation once a supplier package was placed", async () => {
    const f = await paidMixed();
    const { stripe, calls } = fakeStripe();
    await markShipped(f.store, SESSION_ID, "test-studio", { carrier: "USPS", trackingNumber: "9400111111111111111111", trackingUrl: "" });
    expect((await cancelPackage(stripe, f.store, SESSION_ID, "test-studio")).ok).toBe(false);
    await f.store.get<Order>(orderKey(SESSION_ID)).then(async (cur) => {
      const o = cur!.value;
      g(o, "test-supplier-a").status = "sent_to_supplier";
      await f.store.replace(orderKey(SESSION_ID), o, (await f.store.get(orderKey(SESSION_ID)))!.etag);
    });
    const blocked = await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-a");
    expect(blocked).toEqual({ ok: false, error: expect.stringContaining("Cancel it with them first") });
    expect(calls).toHaveLength(0);
    expect((await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-a", { supplierCanceled: true })).ok).toBe(true);
  });

  it("canceling every package leaves the order canceled and fully refunded", async () => {
    const f = await paidMixed();
    const { stripe } = fakeStripe();
    for (const id of ["test-studio", "test-supplier-a", "test-supplier-b"]) expect((await cancelPackage(stripe, f.store, SESSION_ID, id)).ok).toBe(true);
    const o = await reload(f);
    expect(o.status).toBe("canceled");
    expect(o.paymentStatus).toBe("refunded");
    expect(refundedSoFar(o)).toBe(o.amounts.total);
  });

  it("a package refund never exceeds what's left on the order", async () => {
    const f = await paidMixed();
    const { stripe, calls } = fakeStripe();
    await refundOrder(stripe, f.store, SESSION_ID, 4000); // owner refunded most of it by amount
    const r = await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-b");
    expect(r.ok).toBe(true);
    expect(calls[1].params.amount).toBe(649);
    expect(refundedSoFar(await reload(f))).toBe(4649);
  });
});

describe("one package lost or returned", () => {
  const ship = (f: Awaited<ReturnType<typeof paidMixed>>, id: string, tracking = "9400111111111111111111") => markShipped(f.store, SESSION_ID, id, { carrier: "USPS", trackingNumber: tracking, trackingUrl: "" });

  it("lost → free replacement with a new ship-by date, a new tracking number and its own email", async () => {
    const f = await paidMixed();
    await ship(f, "test-studio");
    expect((await markLost(f.store, SESSION_ID, "test-studio", new Date("2026-11-05T15:00:00Z"))).ok).toBe(true);
    let o = await reload(f);
    expect(orderAttention(o).map((a) => a.code)).toContain("package-lost");
    expect((await markShipped(f.store, SESSION_ID, "test-studio", { carrier: "USPS", trackingNumber: "9400222222222222222222", trackingUrl: "" })).ok).toBe(false);

    expect((await reshipPackage(f.store, SESSION_ID, "test-studio", new Date("2026-11-05T15:00:00Z"))).ok).toBe(true);
    o = await reload(f);
    expect(g(o, "test-studio")).toMatchObject({ status: "unfulfilled", resolution: "reshipped", shipBy: "2026-11-09", trackingNumber: null });
    expect(g(o, "test-studio").previousShipments).toEqual([expect.objectContaining({ trackingNumber: "9400111111111111111111", outcome: "lost" })]);
    expect(orderAttention(o).map((a) => a.code)).not.toContain("package-lost");

    await ship(f, "test-studio", "9400222222222222222222");
    const sent: string[] = [];
    const mailer: Mailer = { async send(m) { sent.push(m.subject); return { ok: true }; } };
    const cfg: NotifyConfig = { mailer, ownerEmail: null, ownerOrdersUrl: "", sendInTestMode: true, siteUrl: "https://funksquish.com", contactEmail: "x@example.com" };
    o = await reload(f);
    await notifyShipped(f.store, o, "test-studio", cfg);
    await notifyShipped(f.store, await reload(f), "test-studio", cfg); // retried: still one email
    expect(sent).toEqual([expect.stringContaining("(replacement)")]);
    expect(shippingEmail(o, "test-studio").html).toMatch(/at no cost to you/);
  });

  it("lost → or refund the package in full instead", async () => {
    const f = await paidMixed();
    const { stripe, calls } = fakeStripe();
    await ship(f, "test-supplier-a");
    await markLost(f.store, SESSION_ID, "test-supplier-a");
    expect((await refundPackage(stripe, f.store, SESSION_ID, "test-supplier-a")).ok).toBe(true);
    expect(calls[0].params.amount).toBe(795 + 599 + 36);
    const o = await reload(f);
    expect(g(o, "test-supplier-a").resolution).toBe("refunded");
    expect(orderAttention(o).map((a) => a.code)).not.toContain("package-lost");
    expect((await reshipPackage(f.store, SESSION_ID, "test-supplier-a")).ok).toBe(false); // already settled
    expect((await refundPackage(stripe, f.store, SESSION_ID, "test-supplier-a")).ok).toBe(false); // nothing left
  });

  it("returned undeliverable → the order page shows the 5-business-day refund deadline", async () => {
    const f = await paidMixed();
    await ship(f, "test-studio");
    const at = new Date("2026-11-06T15:00:00Z"); // Friday
    expect((await markReturned(f.store, SESSION_ID, "test-studio", "address", at)).ok).toBe(true);
    const o = await reload(f);
    expect(returnedRefundDeadline(at.toISOString())).toBe("2026-11-16"); // Mon 9, Tue 10, (Veterans Day 11th skipped), Thu 12, Fri 13, Mon 16
    const a = orderAttention(o).find((x) => x.code === "package-returned")!;
    expect(a.label).toMatch(/by 2026-11-16/);
    expect(a.label).toMatch(/refund \(or reship if the customer agrees\)/);
    expect((await markReturned(f.store, SESSION_ID, "test-supplier-b", "carrier", at)).ok).toBe(false); // not shipped
  });

  it("carrier- or our-fault returns offer a free reship", async () => {
    const f = await paidMixed();
    await ship(f, "test-studio");
    await markReturned(f.store, SESSION_ID, "test-studio", "carrier");
    expect(orderAttention(await reload(f)).find((x) => x.code === "package-returned")!.label).toMatch(/reship free or refund/);
    expect((await reshipPackage(f.store, SESSION_ID, "test-studio")).ok).toBe(true);
  });

  it("the order is fulfilled once every remaining package has shipped", async () => {
    const f = await paidMixed();
    const { stripe } = fakeStripe();
    await ship(f, "test-studio");
    expect((await reload(f)).status).toBe("partially_fulfilled");
    await cancelPackage(stripe, f.store, SESSION_ID, "test-supplier-b");
    await ship(f, "test-supplier-a");
    expect((await reload(f)).status).toBe("fulfilled");
  });

  it("whole-order cancel is still refused once any package shipped", async () => {
    const f = await paidMixed();
    const { stripe } = fakeStripe();
    await ship(f, "test-studio");
    expect((await cancelOrder(stripe, f.store, SESSION_ID)).ok).toBe(false);
  });
});

describe("what the customer is told", () => {
  it("the confirmation lists each package, its ship-by date and shipping, and promises no later shipping charges", async () => {
    const o = await reload(await paidMixed());
    const html = customerConfirmationEmail(o, { siteUrl: "https://funksquish.com", contactEmail: "x@example.com" }).html;
    expect(html).toMatch(/ships in <b>3 separate packages<\/b>, each with its own tracking email/);
    expect(html).toMatch(/Package 1 \(from FunkSquish\)<\/b>: Blue × 2 — ships by Tuesday, October 27 · shipping \$6\.50/);
    expect(html).toMatch(/Package 2 \(from a supplier partner\)<\/b>: Mint × 1 — ships by Wednesday, October 28/);
    expect(html).toMatch(/we never add shipping charges later/);
    expect(html).not.toMatch(/test-supplier/); // origin ids stay private
  });

  it("each shipping email names its package and mentions the others", async () => {
    const f = await paidMixed();
    await markShipped(f.store, SESSION_ID, "test-supplier-a", { carrier: "USPS", trackingNumber: "9400111111111111111111", trackingUrl: "" });
    const html = shippingEmail(await reload(f), "test-supplier-a").html;
    expect(html).toMatch(/Package 2 \(from a supplier partner\)/);
    expect(html).toMatch(/Your other 2 packages ship separately/);
  });
});

describe("signature confirmation (advisory)", () => {
  it("is recommended to the owner at $150+, never charged or advertised", () => {
    expect(SIGNATURE_POLICY).toEqual({ recommendAtOrAboveCents: 15000, chargeCustomer: false, advertised: false });
    expect(signatureRecommended(14999)).toBe(false);
    expect(signatureRecommended(15000)).toBe(true);
  });
});

describe("stock commit for a mixed order", () => {
  it("is still exactly once per order", async () => {
    const f = await paidMixed();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_2", "checkout.session.completed");
    await commitStock(f.store, CHECKOUT_ID, [{ variantId: "test-var-jelly-blue", quantity: 2, onHand: 5 }], 1_900_000_000);
    const ledger = (await f.store.get<VariantLedger>("stock/test-var-jelly-blue"))!.value;
    expect(Object.keys(ledger.entries)).toEqual([CHECKOUT_ID]);
  });
});
