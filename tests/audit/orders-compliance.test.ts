import { describe, expect, it } from "vitest";
import { checkedLine, quoteFor } from "../checkout/shipping-helpers";
import { fulfillCheckoutSession, orderKey } from "@/commerce/orders/fulfill";
import { handleStripeEvent, HANDLED_EVENT_TYPES, type VerifiedEvent } from "@/commerce/orders/webhook";
import { orderAttention, sendDelayNotice, setShipBy } from "@/commerce/orders/admin";
import { customerConfirmationEmail, delayNoticeEmail, shippingEmail, type Mailer, type NotifyConfig } from "@/commerce/orders/notify";
import { buildCheckoutSessionParams, policyVersionsTag, TERMS_NOTICE } from "@/commerce/checkout/stripe";
import { snapshotFromStripeSession } from "@/commerce/orders/session-snapshot";
import { POLICIES } from "@/content/policies";
import type { Order } from "@/commerce/orders/types";
import type Stripe from "stripe";
import { fakeDeps, snapshot, SESSION_ID } from "../orders/helpers";

const reload = async (f: ReturnType<typeof fakeDeps>) => (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;
const ev = (id: string, type: string, object: Record<string, unknown>): VerifiedEvent => ({ id, type, livemode: false, data: { object } });

function mailer(fail = false) {
  const sent: { to: string; subject: string; html: string }[] = [];
  return { sent, async send(m: { to: string; subject: string; html: string }) { if (fail) return { ok: false as const, code: "brevo-500" }; sent.push(m); return { ok: true as const }; } } satisfies Mailer & { sent: unknown[] };
}
const cfg = (m: Mailer | null): NotifyConfig => ({ mailer: m, ownerEmail: "o@x.example", ownerOrdersUrl: "https://x/orders", sendInTestMode: true, siteUrl: "https://funksquish.com", contactEmail: "travis@funksquish.com" });

async function paid(at = "2026-10-24T12:00:00Z") {
  const f = fakeDeps();
  f.deps.now = () => new Date(at);
  await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
  return f;
}

describe("ship-by dates on orders (Shipping Policy: 2 business days)", () => {
  it("our own stock gets a ship-by date; supplier packages wait for the owner", async () => {
    const f = await paid("2026-10-24T16:00:00Z"); // Saturday noon Eastern
    const o = await reload(f);
    expect(o.fulfillments.find((g) => g.source === "in_house")!.shipBy).toBe("2026-10-27"); // Tuesday
    expect(o.fulfillments.find((g) => g.source === "supplier")!.shipBy).toBeNull();
  });

  it("the owner sees what's due, overdue or missing a date", async () => {
    const f = await paid("2026-10-24T16:00:00Z");
    const o = await reload(f);
    expect(orderAttention(o, new Date("2026-10-26T15:00:00Z")).map((a) => a.code)).toEqual(["set-ship-by"]);
    expect(orderAttention(o, new Date("2026-10-27T15:00:00Z")).map((a) => a.code)).toEqual(["ship-due-today", "set-ship-by"]);
    expect(orderAttention(o, new Date("2026-10-28T15:00:00Z")).map((a) => a.code)).toContain("ship-overdue");
    const r = await setShipBy(f.store, SESSION_ID, "supplier-1", "2026-11-03");
    expect(r.ok).toBe(true);
    expect((await setShipBy(f.store, SESSION_ID, "supplier-1", "2026-11-20")).ok).toBe(false); // only a delay notice can move it
  });
});

describe("delay notices follow the FTC Mail Order Rule (16 CFR 435.2(b))", () => {
  it("a first delay to a date within 30 days: silence counts as agreement, and the date moves", async () => {
    const f = await paid("2026-10-24T16:00:00Z");
    const m = mailer();
    const r = await sendDelayNotice(f.store, SESSION_ID, "in_house-1", "2026-11-10", cfg(m), new Date("2026-10-26T14:00:00Z"));
    expect(r.ok).toBe(true);
    const g = (await reload(f)).fulfillments.find((x) => x.id === "in_house-1")!;
    expect(g.shipBy).toBe("2026-11-10");
    expect(g.delayNotices).toEqual([expect.objectContaining({ previousShipBy: "2026-10-27", newShipBy: "2026-11-10", expressConsentNeeded: false, email: "sent" })]);
    expect(m.sent[0].to).toBe("buyer@example.com");
    expect(m.sent[0].html).toMatch(/cancel these items for a full refund/);
    expect(m.sent[0].html).toMatch(/if we don't hear from you, we'll take that as agreeing to wait until 2026-11-10/);
  });

  it("over 30 days, no date, or a second delay: asks for express consent", async () => {
    const f = await paid("2026-10-24T16:00:00Z");
    const m = mailer();
    await sendDelayNotice(f.store, SESSION_ID, "in_house-1", "2026-12-15", cfg(m), new Date("2026-10-26T14:00:00Z"));
    expect(m.sent[0].html).toMatch(/Please reply to let us know you're happy to wait/);
    expect(m.sent[0].html).toMatch(/if they haven't shipped by 2026-11-26/);
    const g = await paid("2026-10-24T16:00:00Z");
    await sendDelayNotice(g.store, SESSION_ID, "in_house-1", "2026-11-03", cfg(m), new Date("2026-10-26T14:00:00Z"));
    await sendDelayNotice(g.store, SESSION_ID, "in_house-1", "2026-11-05", cfg(m), new Date("2026-11-02T14:00:00Z"));
    expect((await reload(g)).fulfillments[0].delayNotices!.map((d) => d.expressConsentNeeded)).toEqual([false, true]);
    const h = await paid("2026-10-24T16:00:00Z");
    await sendDelayNotice(h.store, SESSION_ID, "in_house-1", null, cfg(m), new Date("2026-10-26T14:00:00Z"));
    expect((await reload(h)).fulfillments[0]).toMatchObject({ shipBy: "2026-10-27", delayNotices: [expect.objectContaining({ newShipBy: null, expressConsentNeeded: true })] });
  });

  it("a failed email changes nothing, and dates in the past are refused", async () => {
    const f = await paid("2026-10-24T16:00:00Z");
    expect((await sendDelayNotice(f.store, SESSION_ID, "in_house-1", "2026-11-10", cfg(mailer(true)), new Date("2026-10-26T14:00:00Z"))).ok).toBe(false);
    expect((await reload(f)).fulfillments[0].shipBy).toBe("2026-10-27");
    expect((await sendDelayNotice(f.store, SESSION_ID, "in_house-1", "2026-10-25", cfg(mailer()), new Date("2026-10-26T14:00:00Z"))).ok).toBe(false);
  });

  it("the email lists only the delayed package's items", async () => {
    const f = await paid();
    const html = delayNoticeEmail(await reload(f), "supplier-1", { newShipBy: null, originalShipBy: null, expressConsentNeeded: true, cancelBy: null }, cfg(null)).html;
    expect(html).toContain("Mint");
    expect(html).not.toContain("Blue");
  });
});

describe("card disputes are recorded on the order", () => {
  it("handles the dispute events and keeps the evidence deadline", () => {
    for (const t of ["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"]) expect(HANDLED_EVENT_TYPES).toContain(t);
  });

  it("flags the order while open and clears the flag when closed", async () => {
    const f = await paid();
    const dispute = { id: "dp_1", payment_intent: "pi_test_123", amount: 2250, reason: "product_not_received", status: "needs_response", evidence_details: { due_by: 1762300800 } };
    await handleStripeEvent(ev("evt_d1", "charge.dispute.created", dispute), f.deps);
    let o = await reload(f);
    expect(o.flags).toContain("disputed");
    expect(o.disputes![0]).toMatchObject({ stripeDisputeId: "dp_1", status: "needs_response", reason: "product_not_received", evidenceDueBy: new Date(1762300800 * 1000).toISOString() });
    expect(orderAttention(o)[0].code).toBe("dispute");
    await handleStripeEvent(ev("evt_d1", "charge.dispute.created", dispute), f.deps); // duplicate
    await handleStripeEvent(ev("evt_d2", "charge.dispute.closed", { ...dispute, status: "won" }), f.deps);
    o = await reload(f);
    expect(o.disputes).toHaveLength(1);
    expect(o.disputes![0].status).toBe("won");
    expect(o.flags).not.toContain("disputed");
  });

  it("keeps a dispute that arrives before its order (seen on the preview: 1 s earlier)", async () => {
    const f = fakeDeps();
    f.deps.now = () => new Date("2026-10-24T12:00:00Z");
    const dispute = { id: "dp_early", payment_intent: "pi_test_123", amount: 2250, reason: "fraudulent", status: "needs_response", evidence_details: { due_by: 1762300800 } };
    expect(await handleStripeEvent(ev("evt_early", "charge.dispute.created", dispute), f.deps)).toEqual({ status: "processed" });
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    let o = await reload(f);
    expect(o.flags).toContain("disputed");
    expect(o.disputes).toEqual([expect.objectContaining({ stripeDisputeId: "dp_early", status: "needs_response", reason: "fraudulent" })]);
    // Applied once: fulfilling again (landing page + webhook) adds nothing, and later events update it.
    await fulfillCheckoutSession(SESSION_ID, f.deps, "landing-page", "landing-page");
    await handleStripeEvent(ev("evt_late", "charge.dispute.closed", { ...dispute, status: "lost" }), f.deps);
    o = await reload(f);
    expect(o.disputes).toHaveLength(1);
    expect(o.disputes![0].status).toBe("lost");
    expect(o.flags).not.toContain("disputed");
  });
});

describe("checkout records which policies applied, and says so before payment", () => {
  const auditLines = [checkedLine({ variantId: "v", productId: "p", sku: "S", name: "N" })];
  const params = buildCheckoutSessionParams({
    lines: auditLines,
    checkoutId: "11111111-2222-3333-4444-555555555555",
    config: { returnOrigin: "https://preview.example", automaticTax: false },
    shipping: quoteFor(auditLines),
    expiresAt: 2_000_000_000,
  });

  it("shows the Terms notice next to Stripe's Pay button", () => {
    expect(params.custom_text?.submit).toEqual({ message: TERMS_NOTICE });
    expect(TERMS_NOTICE.length).toBeLessThanOrEqual(1200);
    for (const p of ["/terms", "/shipping", "/returns"]) expect(TERMS_NOTICE).toContain(`funksquish.com${p}`);
  });

  it("stores the policy versions on the session and then the order", async () => {
    expect(params.metadata?.policy_versions).toBe(policyVersionsTag());
    expect(policyVersionsTag()).toBe(`terms=${POLICIES.terms.version};shipping=${POLICIES.shipping.version};returns=${POLICIES.returns.version};privacy=${POLICIES.privacy.version}`);
    const snap = snapshotFromStripeSession({ id: "cs_test_x", livemode: false, status: "complete", payment_status: "paid", metadata: { policy_versions: "terms=2026-10-27" }, line_items: { data: [] } } as unknown as Stripe.Checkout.Session);
    expect(snap.policyVersions).toBe("terms=2026-10-27");
    const f = fakeDeps(snapshot({ policyVersions: policyVersionsTag() }));
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    expect((await reload(f)).policyVersions).toBe(policyVersionsTag());
  });
});

describe("order emails say what the policies say", () => {
  it("the shipping email treats the 7-day damage window as a preference", async () => {
    const f = await paid();
    const html = shippingEmail(await reload(f), "in_house-1").html;
    expect(html).toMatch(/ideally within 7 days of delivery/);
    expect(html).not.toMatch(/email us within 7 days/);
  });

  it("the confirmation promises a delay email with a refund option, and points supplier items at the time shown when ordering", async () => {
    const f = await paid();
    const html = customerConfirmationEmail(await reload(f), cfg(null)).html;
    expect(html).toMatch(/Items from our own stock ship within 2 business days/);
    expect(html).toMatch(/processing time shown on their product page when you ordered/);
    expect(html).toMatch(/we'll email you before its ship-by date with your options, including a full refund/);
    expect(html).toMatch(/we never add shipping charges later/);
  });
});
