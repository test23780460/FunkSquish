import { describe, expect, it } from "vitest";
import { fulfillCheckoutSession, orderKey, recordRefund } from "@/commerce/orders/fulfill";
import { availableUnits, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import type { KvStore } from "@/commerce/orders/store";
import type { Order } from "@/commerce/orders/types";
import { handleStripeEvent, type VerifiedEvent } from "@/commerce/orders/webhook";
import { CHECKOUT_ID, SESSION_ID, fakeDeps } from "./helpers";

/**
 * Stripe doesn't promise event order and retries failed deliveries for days, so
 * dispute events can arrive late, out of order, before the order exists, or
 * while another request is replaying parked events. Every test here fixes the
 * interleaving explicitly, so none depends on timing.
 */

const NOW = Math.floor(new Date("2026-10-24T12:00:00Z").getTime() / 1000);
const PARKED = "dispute/parked/pi_test_123";
const base = { id: "dp_1", payment_intent: "pi_test_123", amount: 2250, reason: "fraudulent", evidence_details: { due_by: 1762300800 } };

/** A Stripe dispute event; `created` is Stripe's event time (seconds). */
const dispute = (id: string, type: string, status: string, created: number, extra: Record<string, unknown> = {}): VerifiedEvent =>
  ({ id, type, created, livemode: false, data: { object: { ...base, status, ...extra } } }) as VerifiedEvent;

const opened = dispute("evt_created", "charge.dispute.created", "needs_response", NOW + 10);
const reviewing = dispute("evt_updated", "charge.dispute.updated", "under_review", NOW + 20);
const won = dispute("evt_closed", "charge.dispute.closed", "won", NOW + 30);

const order = async (f: ReturnType<typeof fakeDeps>) => (await f.store.get<Order>(orderKey(SESSION_ID)))?.value ?? null;
const complete = (f: ReturnType<typeof fakeDeps>, source = "evt_paid") => fulfillCheckoutSession(SESSION_ID, f.deps, source, "checkout.session.completed");

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
  return availableUnits(onHand, ledger, NOW + 100_000);
}

/** Runs `hook` once, right after the first read of `key` returns — i.e. between a reader's read and its write. */
function pauseAfterRead(f: ReturnType<typeof fakeDeps>, key: string, hook: () => Promise<void>) {
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
  expect(o?.flags).not.toContain("disputed");
}

describe("dispute events out of order never move a dispute backwards", () => {
  it("ignores a late 'created' after 'closed' (order already exists)", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(won, f.deps);
    await handleStripeEvent(opened, f.deps); // first delivery of an older event, e.g. a Stripe retry
    await handleStripeEvent(reviewing, f.deps);
    expectClosedWon(await order(f));
  });

  it("ignores stale statuses even when Stripe's event time is missing", async () => {
    const f = fakeDeps();
    await complete(f);
    const strip = (e: VerifiedEvent) => ({ ...e, created: undefined }) as VerifiedEvent;
    await handleStripeEvent(strip(won), f.deps);
    await handleStripeEvent(strip(opened), f.deps);
    expectClosedWon(await order(f));
  });

  it("applies every forward step in order: created → updated → closed", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(opened, f.deps);
    expect((await order(f))?.flags).toContain("disputed");
    await handleStripeEvent(reviewing, f.deps);
    expect((await order(f))?.disputes?.[0].status).toBe("under_review");
    expect((await order(f))?.flags).toContain("disputed");
    await handleStripeEvent(won, f.deps);
    expectClosedWon(await order(f));
  });

  it("within one stage, the newer Stripe event wins (evidence deadline moved)", async () => {
    const f = fakeDeps();
    await complete(f);
    const later = dispute("evt_due2", "charge.dispute.updated", "needs_response", NOW + 40, { evidence_details: { due_by: 1762400000 } });
    const earlier = dispute("evt_due1", "charge.dispute.updated", "needs_response", NOW + 15, { evidence_details: { due_by: 1762350000 } });
    await handleStripeEvent(later, f.deps);
    await handleStripeEvent(earlier, f.deps);
    expect((await order(f))?.disputes?.[0].evidenceDueBy).toBe(new Date(1762400000 * 1000).toISOString());
  });

  it("an inquiry that escalates to a chargeback moves forward", async () => {
    const f = fakeDeps();
    await complete(f);
    await handleStripeEvent(dispute("evt_w", "charge.dispute.created", "warning_needs_response", NOW + 1), f.deps);
    await handleStripeEvent(dispute("evt_e", "charge.dispute.updated", "needs_response", NOW + 2), f.deps);
    const o = await order(f);
    expect(o?.disputes?.[0].status).toBe("needs_response");
    expect(o?.flags).toContain("disputed");
  });
});

describe("parked disputes (event before the order) keep the newest status", () => {
  it("'closed' parked first, then a late 'created': the order shows closed", async () => {
    const f = fakeDeps();
    await handleStripeEvent(won, f.deps);
    await handleStripeEvent(opened, f.deps); // must not replace the newer parked event
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

  it("a stale parked event replayed while 'closed' is applied directly can't reopen the dispute", async () => {
    const f = fakeDeps();
    await handleStripeEvent(opened, f.deps); // parked: no order yet
    // The order's replay reads the parked 'created'; before it writes, 'closed' arrives and is applied directly.
    pauseAfterRead(f, PARKED, async () => {
      await handleStripeEvent(won, f.deps);
    });
    await complete(f);
    expectClosedWon(await order(f));
  });

  it("the order is created between the dispute's order lookup and its parking", async () => {
    const f = fakeDeps();
    // The dispute finds no order, then the order is created (its replay sees nothing parked yet), then the dispute parks.
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

describe("dispute events never touch stock or refunds, and duplicates are harmless", () => {
  it("any order and any number of duplicates: one order, stock committed once, refunds unchanged", async () => {
    const f = fakeDeps();
    await holdStock(f);
    await handleStripeEvent(reviewing, f.deps); // parked
    await complete(f);
    await recordRefund("pi_test_123", 100, f.deps, "evt_refund");
    const before = await order(f);
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
});
