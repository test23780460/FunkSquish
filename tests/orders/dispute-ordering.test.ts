import { describe, expect, it, vi } from "vitest";
import { fulfillCheckoutSession, orderKey, recordRefund } from "@/commerce/orders/fulfill";
import { orderAttention } from "@/commerce/orders/admin";
import { disputeAttentionLabel, disputeNeedsOwner, disputeState, isOpenDispute, type DisputeFacts } from "@/commerce/orders/dispute-status";
import { availableUnits, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import type { KvStore } from "@/commerce/orders/store";
import type { Order } from "@/commerce/orders/types";
import { handleStripeEvent, type VerifiedEvent } from "@/commerce/orders/webhook";
import { CHECKOUT_ID, SESSION_ID, fakeDeps } from "./helpers";

/**
 * Stripe doesn't promise event order, retries failed deliveries for days, and
 * event times are whole seconds (ties happen). Dispute events can arrive late,
 * out of order, in the same second, before the order exists, or while another
 * request is replaying parked events. Every test fixes the interleaving
 * explicitly, so none depends on timing.
 */

const NOW = Math.floor(new Date("2026-10-24T12:00:00Z").getTime() / 1000);
const PARKED = "dispute/parked/pi_test_123";
const DUE1 = 1762300800; // evidence deadlines (Stripe seconds)
const DUE2 = 1762400000;
const iso = (s: number) => new Date(s * 1000).toISOString();
const base = { id: "dp_1", payment_intent: "pi_test_123", amount: 2250, reason: "fraudulent", evidence_details: { due_by: DUE1 } };

/** A Stripe dispute event; `created` is Stripe's event time (seconds). */
const dispute = (id: string, type: string, status: string, created: number | undefined, extra: Record<string, unknown> = {}): VerifiedEvent =>
  ({ id, type, created, livemode: false, data: { object: { ...base, status, ...extra } } }) as VerifiedEvent;

const opened = dispute("evt_created", "charge.dispute.created", "needs_response", NOW + 10);
const reviewing = dispute("evt_updated", "charge.dispute.updated", "under_review", NOW + 20);
const won = dispute("evt_closed", "charge.dispute.closed", "won", NOW + 30);

type F = ReturnType<typeof fakeDeps>;
const order = async (f: F) => (await f.store.get<Order>(orderKey(SESSION_ID)))?.value ?? null;
const record = async (f: F) => (await order(f))?.disputes?.[0];
const complete = (f: F, source = "evt_paid") => fulfillCheckoutSession(SESSION_ID, f.deps, source, "checkout.session.completed");

/** A ticking clock (so "when Stripe was read" differs per read) and a fake Stripe that holds each dispute's current state. */
function withStripe(f: F, current: Partial<DisputeFacts> = {}) {
  let tick = 0;
  f.deps.now = () => new Date(Date.parse("2026-10-24T12:00:00Z") + tick++ * 1000);
  const stripe = {
    facts: { status: "needs_response", amount: 2250, evidenceDueBy: iso(DUE1), ...current } as DisputeFacts,
    calls: 0,
    fail: false,
  };
  f.deps.retrieveDispute = async (id: string) => {
    stripe.calls++;
    if (stripe.fail) throw Object.assign(new Error("Stripe unavailable"), { type: "StripeConnectionError" });
    if (id !== "dp_1") throw Object.assign(new Error("No such dispute"), { code: "resource_missing" });
    return { ...stripe.facts };
  };
  return stripe;
}

async function holdStock(f: F) {
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
async function stockLeft(f: F, variantId: string, onHand: number) {
  const ledger = (await f.store.get<VariantLedger>(`stock/${variantId}`))?.value ?? null;
  return availableUnits(onHand, ledger, NOW + 100_000);
}

/** Runs `hook` once, right after the first read of `key` returns — i.e. between a reader's read and its write. */
function pauseAfterRead(f: F, key: string, hook: () => Promise<void>) {
  const store: KvStore = f.store;
  let fired = false;
  // Everything else goes straight to the real store (same data, same versions).
  f.deps.store = new Proxy(store, {
    get(target, prop, receiver) {
      if (prop !== "get") {
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      }
      return async <T,>(k: string) => {
        const result = await target.get<T>(k);
        if (k === key && !fired) {
          fired = true;
          await hook();
        }
        return result;
      };
    },
  });
}

function expectClosedWon(o: Order | null) {
  expect(o?.disputes).toHaveLength(1);
  expect(o?.disputes?.[0]).toMatchObject({ stripeDisputeId: "dp_1", status: "won" });
  expect(o?.disputes?.[0].needsCheck).toBeFalsy();
  expect(o?.flags).not.toContain("disputed");
}

describe("every documented Stripe dispute status has an explicit meaning", () => {
  // https://docs.stripe.com/api/disputes/object (checked 2026-10-31)
  const table: [string, string, boolean][] = [
    ["warning_needs_response", "needs_response", true],
    ["warning_under_review", "under_review", true],
    ["warning_closed", "closed", false],
    ["needs_response", "needs_response", true],
    ["under_review", "under_review", true],
    ["appeal_needs_response", "needs_response", true],
    ["appeal_under_review", "under_review", true],
    ["won", "closed", false],
    ["lost", "closed", false],
    ["prevented", "closed", false],
  ];
  it.each(table)("%s → %s (needs the owner: %s)", (status, state, needsOwner) => {
    expect(disputeState(status)).toBe(state);
    expect(disputeNeedsOwner({ status })).toBe(needsOwner);
    expect(isOpenDispute(status)).toBe(needsOwner);
  });

  it("an unknown status is never treated as closed: the owner is asked to check it", () => {
    expect(disputeState("pre_arbitration")).toBe("unknown");
    expect(disputeNeedsOwner({ status: "pre_arbitration" })).toBe(true);
    expect(disputeAttentionLabel({ status: "pre_arbitration", reason: "fraudulent", evidenceDueBy: null })).toMatch(/doesn't recognize \("pre_arbitration"\).*check it in Stripe/);
  });

  it("appeals that need a response say so, with the deadline", () => {
    expect(disputeAttentionLabel({ status: "appeal_needs_response", reason: "fraudulent", evidenceDueBy: iso(DUE2) })).toBe(
      `Card dispute appeal (fraudulent) — respond in Stripe by ${iso(DUE2).slice(0, 10)}`,
    );
    expect(disputeAttentionLabel({ status: "appeal_under_review", reason: null, evidenceDueBy: null })).toMatch(/^Card dispute appeal .*waiting for the bank/);
    expect(disputeAttentionLabel({ status: "won", reason: null, evidenceDueBy: null })).toBeNull();
    expect(disputeAttentionLabel({ status: "won", reason: null, evidenceDueBy: null, needsCheck: true })).toMatch(/conflicting updates/);
  });
});

describe("dispute lifecycles, including appeals and late wins", () => {
  it("normal dispute: created → under review → won; Stripe is asked only when something changes", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f);
    await handleStripeEvent(opened, f.deps);
    expect((await order(f))?.flags).toContain("disputed");
    expect(stripe.calls).toBe(0); // first report: nothing to reconcile
    stripe.facts.status = "under_review";
    await handleStripeEvent(reviewing, f.deps);
    expect((await record(f))?.status).toBe("under_review");
    expect((await order(f))?.flags).toContain("disputed");
    stripe.facts.status = "won";
    await handleStripeEvent(won, f.deps);
    expectClosedWon(await order(f));
    expect(stripe.calls).toBe(2);
    for (const e of [opened, reviewing, won]) await handleStripeEvent(e, f.deps); // duplicate deliveries
    expect(stripe.calls).toBe(2);
  });

  it("lost → appeal needs a response → appeal under review → won: the appeal stays visible until it's decided", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f, { status: "lost" });
    await handleStripeEvent(dispute("evt_lost", "charge.dispute.closed", "lost", NOW + 10), f.deps);
    expect((await order(f))?.flags).not.toContain("disputed");

    stripe.facts = { status: "appeal_needs_response", amount: 2250, evidenceDueBy: iso(DUE2) };
    await handleStripeEvent(dispute("evt_appeal", "charge.dispute.updated", "appeal_needs_response", NOW + 20, { evidence_details: { due_by: DUE2 } }), f.deps);
    let o = await order(f);
    expect(o?.disputes?.[0]).toMatchObject({ status: "appeal_needs_response", evidenceDueBy: iso(DUE2) });
    expect(o?.flags).toContain("disputed");
    expect(orderAttention(o!).map((a) => a.label)).toContain(`Card dispute appeal (fraudulent) — respond in Stripe by ${iso(DUE2).slice(0, 10)}`);

    stripe.facts.status = "appeal_under_review";
    await handleStripeEvent(dispute("evt_appeal2", "charge.dispute.updated", "appeal_under_review", NOW + 30), f.deps);
    o = await order(f);
    expect(o?.disputes?.[0].status).toBe("appeal_under_review");
    expect(o?.flags).toContain("disputed");

    // A late copy of the original "lost" can't hide the appeal.
    await handleStripeEvent(dispute("evt_lost_retry", "charge.dispute.closed", "lost", NOW + 10), f.deps);
    expect((await record(f))?.status).toBe("appeal_under_review");

    stripe.facts.status = "won";
    await handleStripeEvent(dispute("evt_won", "charge.dispute.closed", "won", NOW + 40), f.deps);
    expectClosedWon(await order(f));
  });

  it("a late win (lost → won) is applied, not treated as going backwards", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f, { status: "lost" });
    await handleStripeEvent(dispute("evt_lost", "charge.dispute.closed", "lost", NOW + 10), f.deps);
    stripe.facts.status = "won";
    await handleStripeEvent(dispute("evt_late_win", "charge.dispute.updated", "won", NOW + 90), f.deps);
    expectClosedWon(await order(f));
  });

  it("an inquiry that escalates to a chargeback moves on", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f, { status: "warning_needs_response" });
    await handleStripeEvent(dispute("evt_w", "charge.dispute.created", "warning_needs_response", NOW + 1), f.deps);
    stripe.facts.status = "needs_response";
    await handleStripeEvent(dispute("evt_e", "charge.dispute.updated", "needs_response", NOW + 2), f.deps);
    expect((await record(f))?.status).toBe("needs_response");
    expect((await order(f))?.flags).toContain("disputed");
  });

  it("an unknown status keeps the order flagged until a recognized one replaces it", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f, { status: "pre_arbitration" });
    await handleStripeEvent(dispute("evt_x", "charge.dispute.updated", "pre_arbitration", NOW + 5), f.deps);
    const o = await order(f);
    expect(o?.flags).toContain("disputed");
    expect(orderAttention(o!).some((a) => a.code === "dispute" && /doesn't recognize/.test(a.label))).toBe(true);
    stripe.facts.status = "won";
    await handleStripeEvent(dispute("evt_y", "charge.dispute.closed", "won", NOW + 50), f.deps);
    expectClosedWon(await order(f));
  });
});

describe("older events never overwrite newer dispute information", () => {
  it("a late 'created' after 'closed' is ignored (Stripe confirms 'won')", async () => {
    const f = fakeDeps();
    await complete(f);
    withStripe(f, { status: "won" });
    await handleStripeEvent(won, f.deps);
    await handleStripeEvent(opened, f.deps); // first delivery of an older event, e.g. a Stripe retry
    await handleStripeEvent(reviewing, f.deps);
    expectClosedWon(await order(f));
  });

  it("without Stripe, a late 'created' with an earlier event time is ignored", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(won, f.deps);
    await handleStripeEvent(opened, f.deps);
    await handleStripeEvent(reviewing, f.deps);
    expectClosedWon(await order(f));
  });

  it("without Stripe and without event times, a conflict is never resolved by arrival order: it stays visible for the owner", async () => {
    for (const first of ["won", "created"] as const) {
      const f = fakeDeps();
      await complete(f);
      const a = dispute("evt_a", "charge.dispute.closed", "won", undefined);
      const b = dispute("evt_b", "charge.dispute.created", "needs_response", undefined);
      for (const e of first === "won" ? [a, b] : [b, a]) await handleStripeEvent(e, f.deps);
      const d = await record(f);
      expect(d).toMatchObject({ status: "needs_response", needsCheck: true });
      expect((await order(f))?.flags).toContain("disputed");
    }
  });
});

describe("events in the same second (Stripe times can't order them)", () => {
  const sameSecond = NOW + 30;
  const early = dispute("evt_due_a", "charge.dispute.updated", "needs_response", sameSecond, { evidence_details: { due_by: DUE1 } });
  const lateDue = dispute("evt_due_b", "charge.dispute.updated", "needs_response", sameSecond, { evidence_details: { due_by: DUE2 } });

  it("different evidence deadlines: Stripe's current deadline is stored, whichever arrives last", async () => {
    for (const order_ of [
      [early, lateDue],
      [lateDue, early],
    ]) {
      const f = fakeDeps();
      await complete(f);
      withStripe(f, { evidenceDueBy: iso(DUE2) });
      for (const e of order_) await handleStripeEvent(e, f.deps);
      expect(await record(f)).toMatchObject({ status: "needs_response", evidenceDueBy: iso(DUE2), needsCheck: false });
    }
  });

  it("different statuses: Stripe's current status is stored, whichever arrives last", async () => {
    const closedSame = dispute("evt_s1", "charge.dispute.closed", "won", sameSecond);
    const reviewSame = dispute("evt_s2", "charge.dispute.updated", "under_review", sameSecond);
    for (const order_ of [
      [closedSame, reviewSame],
      [reviewSame, closedSame],
    ]) {
      const f = fakeDeps();
      await complete(f);
      withStripe(f, { status: "won" });
      for (const e of order_) await handleStripeEvent(e, f.deps);
      expectClosedWon(await order(f));
    }
  });

  it("if Stripe can't be reached, the tie isn't guessed: the more urgent report is kept and marked to check in Stripe", async () => {
    for (const order_ of [
      [early, lateDue],
      [lateDue, early],
    ]) {
      const f = fakeDeps();
      await complete(f);
      const stripe = withStripe(f);
      stripe.fail = true;
      vi.spyOn(console, "error").mockImplementation(() => {});
      for (const e of order_) await handleStripeEvent(e, f.deps);
      const o = await order(f);
      // Same result in both arrival orders: the earlier (safer) deadline, flagged for the owner.
      expect(o?.disputes?.[0]).toMatchObject({ evidenceDueBy: iso(DUE1), needsCheck: true });
      expect(o?.flags).toContain("disputed");
      expect(orderAttention(o!).some((a) => /conflicting updates/.test(a.label))).toBe(true);
      // Once Stripe answers again, the next event settles it.
      stripe.fail = false;
      stripe.facts = { status: "won", amount: 2250, evidenceDueBy: iso(DUE2) };
      await handleStripeEvent(won, f.deps);
      expectClosedWon(await order(f));
      vi.restoreAllMocks();
    }
  });

  it("a Stripe failure never drops a newer actionable update (appeal after a decision)", async () => {
    const f = fakeDeps();
    await complete(f);
    const stripe = withStripe(f, { status: "won" });
    await handleStripeEvent(won, f.deps);
    stripe.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await handleStripeEvent(dispute("evt_appeal", "charge.dispute.updated", "appeal_needs_response", NOW + 60), f.deps);
    expect(await record(f)).toMatchObject({ status: "appeal_needs_response" });
    expect((await order(f))?.flags).toContain("disputed");
    vi.restoreAllMocks();
  });
});

describe("parked disputes (event before the order)", () => {
  it("'closed' parked first, then a late 'created': the order shows closed", async () => {
    const f = fakeDeps();
    await handleStripeEvent(won, f.deps);
    await handleStripeEvent(opened, f.deps);
    await complete(f);
    expectClosedWon(await order(f));
    expect((await f.store.get<Record<string, unknown>>(PARKED))?.value).toEqual({});
  });

  it("created, updated and closed all parked in reverse order", async () => {
    const f = fakeDeps();
    for (const e of [won, reviewing, opened]) await handleStripeEvent(e, f.deps);
    await complete(f);
    expectClosedWon(await order(f));
  });

  it("two parked events in the same second are settled by Stripe when the order is created", async () => {
    const f = fakeDeps();
    const a = dispute("evt_p1", "charge.dispute.closed", "won", NOW + 30);
    const b = dispute("evt_p2", "charge.dispute.updated", "under_review", NOW + 30);
    await handleStripeEvent(a, f.deps);
    await handleStripeEvent(b, f.deps); // both kept while parked (none merged away)
    expect(Object.keys((await f.store.get<Record<string, unknown>>(PARKED))!.value)).toHaveLength(2);
    withStripe(f, { status: "won" });
    await complete(f);
    expectClosedWon(await order(f));
  });

  it("a stale parked event replayed while 'closed' is applied directly can't reopen the dispute", async () => {
    const f = fakeDeps();
    await handleStripeEvent(opened, f.deps); // parked: no order yet
    pauseAfterRead(f, PARKED, async () => {
      await handleStripeEvent(won, f.deps);
    });
    await complete(f);
    expectClosedWon(await order(f));
  });

  it("the order is created between the dispute's order lookup and its parking", async () => {
    const f = fakeDeps();
    pauseAfterRead(f, "order/pi/pi_test_123", async () => {
      await complete(f);
    });
    await handleStripeEvent(opened, f.deps);
    const o = await order(f);
    expect(o?.disputes).toEqual([expect.objectContaining({ stripeDisputeId: "dp_1", status: "needs_response" })]);
    expect(o?.flags).toContain("disputed");
    expect((await f.store.get<Record<string, unknown>>(PARKED))?.value).toEqual({});
  });

  it("concurrent replays (webhook + success page) record the dispute once and clear the parking", async () => {
    const f = fakeDeps();
    await handleStripeEvent(opened, f.deps);
    await Promise.all([complete(f, "evt_paid"), complete(f, "landing-page"), handleStripeEvent(reviewing, f.deps)]);
    const o = await order(f);
    expect(o?.disputes).toHaveLength(1);
    expect(o?.disputes?.[0].status).toBe("under_review");
    expect(o?.flags).toContain("disputed");
    expect((await f.store.get<Record<string, unknown>>(PARKED))?.value).toEqual({});
  });
});

describe("concurrent processing", () => {
  it("two conflicting events processed at once end with Stripe's state and one record", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(opened, f.deps);
    withStripe(f, { status: "won" });
    await Promise.all([handleStripeEvent(won, f.deps), handleStripeEvent(dispute("evt_u", "charge.dispute.updated", "under_review", NOW + 30), f.deps)]);
    expectClosedWon(await order(f));
  });

  it("an older Stripe read can't overwrite a newer one, even if it's written last", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(opened, f.deps);
    const stripe = withStripe(f, { status: "under_review" });
    // Event X reads Stripe first (sees under_review) but is held before writing.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const read = f.deps.retrieveDispute!;
    let first = true;
    f.deps.retrieveDispute = async (id) => {
      const facts = await read(id);
      if (first) {
        first = false;
        await held;
      }
      return facts;
    };
    const x = handleStripeEvent(reviewing, f.deps);
    await new Promise((r) => setTimeout(r, 0));
    // Meanwhile the dispute is won, and event Y reads Stripe later and writes first.
    stripe.facts.status = "won";
    await handleStripeEvent(won, f.deps);
    release();
    await x;
    expectClosedWon(await order(f));
  });
});

describe("dispute events never touch stock or refunds, and duplicates are harmless", () => {
  it("any order and any number of duplicates: one order, stock committed once, refunds unchanged", async () => {
    const f = fakeDeps();
    await holdStock(f);
    await handleStripeEvent(reviewing, f.deps); // parked
    await complete(f);
    await recordRefund("pi_test_123", 100, f.deps, "evt_refund");
    const before = await order(f);
    withStripe(f, { status: "won" });
    for (const e of [won, opened, reviewing, won, opened]) await handleStripeEvent(e, f.deps);
    await complete(f, "landing-page");
    await complete(f, "evt_paid");
    const o = await order(f);
    expectClosedWon(o);
    expect(o?.refunds).toEqual(before?.refunds);
    expect(o?.paymentStatus).toBe("partially_refunded");
    expect(o?.inventoryCommitted).toBe(true);
    expect(await stockLeft(f, "test-var-jelly-blue", 5)).toBe(3);
    expect(await stockLeft(f, "test-var-supplier-mint", 3)).toBe(2);
    expect((await f.store.list("order/session/")).length).toBe(1);
  });

  it("a live-mode dispute event is refused by the test integration", async () => {
    const f = fakeDeps();
    await complete(f);
    await expect(handleStripeEvent({ ...won, livemode: true }, f.deps)).rejects.toThrow(/Live-mode event rejected/);
    expect((await order(f))?.disputes).toBeUndefined();
  });
});
