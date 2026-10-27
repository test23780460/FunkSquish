import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { MemoryKvStore } from "@/commerce/orders/store";
import { availableUnits, commitStock, getLedger, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import {
  adjustStock,
  canceledCheckouts,
  currentLive,
  endLive,
  recentActivity,
  releaseCanceled,
  setPaused,
  setTikTokListed,
  startLive,
  stockRow,
  undoAdjustment,
  type AdjustInput,
  type StockItem,
} from "@/commerce/orders/stock-admin";
import { fulfillCheckoutSession, orderKey, recordRefund } from "@/commerce/orders/fulfill";
import { cancelPackage, markShipped, refundOrder, markLost, reshipPackage } from "@/commerce/orders/admin";
import type { Order } from "@/commerce/orders/types";
import { fakeDeps, snapshot, SESSION_ID, CHECKOUT_ID } from "../orders/helpers";

const NOW = new Date("2026-10-27T18:00:00Z");
const SEC = Math.floor(NOW.getTime() / 1000);
const EXP = SEC + 1860;

const adj = (store: MemoryKvStore, over: Partial<AdjustInput> & Pick<AdjustInput, "kind" | "quantity">, now = NOW) =>
  adjustStock(store, { variantId: "a", sku: "SKU-A", requestId: randomUUID(), catalogOnHand: 5, ...over }, now);
const ledger = async (store: MemoryKvStore, v = "a") => (await getLedger(store, v)) as VariantLedger;
const free = async (store: MemoryKvStore, v = "a", catalog = 5) => availableUnits(catalog, await getLedger(store, v), SEC);

describe("one shared stock, changed by hand", () => {
  it("starts from the catalog count; the first change makes it a managed count", async () => {
    const s = new MemoryKvStore();
    expect(await free(s)).toBe(5);
    const r = await adj(s, { kind: "received", quantity: 3 });
    expect(r).toMatchObject({ ok: true, adjustment: { kind: "received", delta: 3, onHandBefore: 5, onHandAfter: 8, source: "owner" } });
    expect((await ledger(s)).onHand).toBe(8);
    expect(await free(s, "a", 999)).toBe(8); // the catalog number no longer matters
  });

  it("a recorded TikTok sale immediately lowers what the website can sell", async () => {
    const s = new MemoryKvStore();
    await adj(s, { kind: "count", quantity: 2 });
    await adj(s, { kind: "tiktok-sale", quantity: 1 });
    expect(await free(s)).toBe(1);
    expect(await reserveStock(s, "c1", [{ variantId: "a", quantity: 2, onHand: 5 }], EXP, SEC)).toMatchObject({ ok: false, available: 1 });
    expect((await reserveStock(s, "c1", [{ variantId: "a", quantity: 1, onHand: 5 }], EXP, SEC)).ok).toBe(true);
  });

  it("records damaged, lost and returned units with the reason and source", async () => {
    const s = new MemoryKvStore();
    const at = (min: number) => new Date(NOW.getTime() + min * 60_000);
    await adj(s, { kind: "damaged", quantity: 1, note: "seam split" }, at(1));
    await adj(s, { kind: "lost", quantity: 1 }, at(2));
    await adj(s, { kind: "returned", quantity: 1, note: "customer return, inspected" }, at(3));
    const l = await ledger(s);
    expect(l.onHand).toBe(4);
    expect(l.recent!.map((a) => [a.kind, a.delta, a.note ?? null])).toEqual([
      ["returned", 1, "customer return, inspected"],
      ["lost", -1, null],
      ["damaged", -1, "seam split"],
    ]);
    const log = await recentActivity(s, NOW);
    expect(log).toHaveLength(3);
    expect(log.map((a) => a.kind)).toEqual(["returned", "lost", "damaged"]); // newest first
    expect(log[0]).toMatchObject({ at: at(3).toISOString(), kind: "returned", delta: 1, sku: "SKU-A", source: "owner", note: "customer return, inspected" });
  });

  it("never lets the count drop below zero silently", async () => {
    const s = new MemoryKvStore();
    const r = await adj(s, { kind: "tiktok-sale", quantity: 6 });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("below zero — you have 5") });
    expect(await getLedger(s, "a")).toBeNull(); // nothing written
    expect((await adj(s, { kind: "correction", quantity: -9, note: "x" })).ok).toBe(false);
  });

  it("warns before taking units the website sold or is holding — and records only when told to", async () => {
    const s = new MemoryKvStore();
    await adj(s, { kind: "count", quantity: 3 });
    await reserveStock(s, "paid", [{ variantId: "a", quantity: 1, onHand: 3 }], EXP, SEC);
    await commitStock(s, "paid", [{ variantId: "a", quantity: 1, onHand: 3 }], SEC);
    await reserveStock(s, "open", [{ variantId: "a", quantity: 1, onHand: 3 }], EXP, SEC);
    const r = await adj(s, { kind: "tiktok-sale", quantity: 2 });
    expect(r).toMatchObject({ ok: false, conflict: { onHand: 3, sold: 1, held: 1, free: 1 } });
    expect((await ledger(s)).onHand).toBe(3);
    const forced = await adj(s, { kind: "tiktok-sale", quantity: 2, force: true });
    expect(forced).toMatchObject({ ok: true, shortForWebsite: 0 });
    // The open checkout's payment now can't be filled: it's flagged instead of shipping a unit that isn't there.
    expect(await commitStock(s, "open", [{ variantId: "a", quantity: 1, onHand: 3 }], SEC)).toEqual({ oversold: true });
  });

  it("a double-tap or retried form records once", async () => {
    const s = new MemoryKvStore();
    const requestId = randomUUID();
    const [x, y] = await Promise.all([adj(s, { kind: "tiktok-sale", quantity: 1, requestId }), adj(s, { kind: "tiktok-sale", quantity: 1, requestId })]);
    expect([x, y].filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect([x, y].filter((r) => r.ok && r.duplicate)).toHaveLength(1);
    expect((await ledger(s)).onHand).toBe(4);
    expect((await recentActivity(s, NOW)).length).toBe(1);
  });

  it("rejects bad input", async () => {
    const s = new MemoryKvStore();
    for (const bad of [
      { kind: "tiktok-sale" as const, quantity: 0 },
      { kind: "tiktok-sale" as const, quantity: 1.5 },
      { kind: "received" as const, quantity: 10_001 },
      { kind: "count" as const, quantity: -1 },
      { kind: "correction" as const, quantity: 2 }, // no reason
    ])
      expect((await adj(s, bad)).ok).toBe(false);
    expect((await adj(s, { kind: "received", quantity: 1, requestId: "not-a-uuid" })).ok).toBe(false);
    expect((await adjustStock(s, { variantId: "u", sku: "U", kind: "tiktok-sale", quantity: 1, requestId: randomUUID(), catalogOnHand: null }, NOW))).toMatchObject({ ok: false, error: expect.stringContaining("no starting count") });
  });

  it("undo reverses your own recent change once; website changes can't be undone", async () => {
    const s = new MemoryKvStore();
    const sale = await adj(s, { kind: "tiktok-sale", quantity: 2 });
    const id = sale.ok ? sale.adjustment!.id : "";
    expect(await undoAdjustment(s, "a", id, NOW)).toMatchObject({ ok: true, adjustment: { kind: "undo", delta: 2, onHandAfter: 5 } });
    expect((await undoAdjustment(s, "a", id, NOW)).ok).toBe(false);
    const late = await adj(s, { kind: "received", quantity: 1 });
    expect((await undoAdjustment(s, "a", late.ok ? late.adjustment!.id : "", new Date(NOW.getTime() + 2 * 86_400_000))).ok).toBe(false);
  });
});

describe("concurrency: the same last units, many hands", () => {
  it("many TikTok sales at once never take the count below zero", async () => {
    const s = new MemoryKvStore();
    const results = await Promise.all(Array.from({ length: 10 }, () => adj(s, { kind: "tiktok-sale", quantity: 1 })));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect((await ledger(s)).onHand).toBe(0);
  });

  it("TikTok sales racing website checkouts for the last units: no unit is promised twice without a warning", async () => {
    const s = new MemoryKvStore();
    await adj(s, { kind: "count", quantity: 3 });
    const ops = await Promise.all([
      ...Array.from({ length: 4 }, (_, i) => reserveStock(s, `web${i}`, [{ variantId: "a", quantity: 1, onHand: 3 }], EXP, SEC).then((r) => ({ web: r.ok }))),
      ...Array.from({ length: 4 }, () => adj(s, { kind: "tiktok-sale", quantity: 1 }).then((r) => ({ tiktok: r.ok }))),
    ]);
    const web = ops.filter((o) => "web" in o && o.web).length;
    const tiktok = ops.filter((o) => "tiktok" in o && o.tiktok).length;
    expect(web + tiktok).toBeLessThanOrEqual(3);
    const l = await ledger(s);
    expect(l.onHand).toBe(3 - tiktok);
    expect(availableUnits(0, l, SEC)).toBeGreaterThanOrEqual(0);
  });
});

describe("pausing website purchasing", () => {
  it("blocks new checkouts for a paused item only; TikTok and counts are unaffected", async () => {
    const s = new MemoryKvStore();
    expect(await setPaused(s, ["a"], true, "TikTok LIVE", "owner", NOW)).toBe(1);
    expect(await reserveStock(s, "c1", [{ variantId: "a", quantity: 1, onHand: 5 }], EXP, SEC)).toMatchObject({ ok: false, paused: true });
    expect((await reserveStock(s, "c2", [{ variantId: "b", quantity: 1, onHand: 5 }], EXP, SEC)).ok).toBe(true);
    expect((await adj(s, { kind: "tiktok-sale", quantity: 1 })).ok).toBe(true);
    await setPaused(s, ["a"], false, "", "owner", NOW);
    expect((await reserveStock(s, "c3", [{ variantId: "a", quantity: 1, onHand: 5 }], EXP, SEC)).ok).toBe(true);
  });

  it("a LIVE pauses its items and resumes only what it paused", async () => {
    const s = new MemoryKvStore();
    await setPaused(s, ["b"], true, "damage check", "owner", NOW);
    const r = await startLive(s, ["a", "b"], true, NOW);
    expect(r.ok && r.session.pausedByLive).toEqual(["a"]);
    expect((await startLive(s, ["a"], true, NOW)).ok).toBe(false); // one at a time
    await adj(s, { kind: "tiktok-sale", quantity: 1, source: "live" });
    await adj(s, { kind: "tiktok-sale", quantity: 1, source: "live" });
    const end = await endLive(s, [{ variantId: "a", sku: "SKU-A", tiktokSales: 3, counted: null, catalogOnHand: 5 }, { variantId: "b", sku: "SKU-B", tiktokSales: null, counted: 4, catalogOnHand: 5 }], true, NOW);
    expect(end.ok && end.errors).toEqual([]);
    expect(end.ok && end.session.reconciliation).toEqual([
      { variantId: "a", recordedSales: 2, tiktokSales: 3, difference: 1, counted: null },
      { variantId: "b", recordedSales: 0, tiktokSales: 0, difference: 0, counted: 4 },
    ]);
    expect((await ledger(s, "a")).onHand).toBe(2); // 5 − 2 recorded − 1 found at reconciliation
    expect((await ledger(s, "a")).paused).toBeNull();
    expect((await ledger(s, "b")).paused).toMatchObject({ by: "owner" }); // the owner's own pause stays
    expect((await ledger(s, "b")).onHand).toBe(4);
    expect(await currentLive(s)).toBeNull();
  });

  it("reconciliation corrects over-recorded sales too", async () => {
    const s = new MemoryKvStore();
    await startLive(s, ["a"], false, NOW);
    await adj(s, { kind: "tiktok-sale", quantity: 2, source: "live" });
    await endLive(s, [{ variantId: "a", sku: "SKU-A", tiktokSales: 1, counted: null, catalogOnHand: 5 }], false, NOW);
    const l = await ledger(s);
    expect(l.onHand).toBe(4);
    expect(l.recent![0]).toMatchObject({ kind: "correction", delta: 1, source: "live", note: "End-of-LIVE: fewer TikTok sales than recorded" });
  });
});

/* ------------------------------ website orders and refunds ------------------------------ */

const fakeStripe = () => ({ refunds: { create: vi.fn(async (p: Stripe.RefundCreateParams) => ({ id: `re_${Math.random()}`, amount: p.amount })) } }) as unknown as Stripe;
const reload = async (f: ReturnType<typeof fakeDeps>) => (await f.store.get<Order>(orderKey(SESSION_ID)))!.value;
const catalog = (v: string) => ({ "test-var-jelly-blue": 5, "test-var-supplier-mint": 3 })[v] ?? null;

async function paid() {
  const f = fakeDeps();
  await reserveStock(f.store, CHECKOUT_ID, [{ variantId: "test-var-jelly-blue", quantity: 2, onHand: 5 }, { variantId: "test-var-supplier-mint", quantity: 1, onHand: 3 }], 1_900_000_000, 1_700_000_000);
  await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
  return f;
}

describe("website orders are never double-counted", () => {
  it("a sale counts once; shipping takes the units off the shelf once, however often tracking is saved", async () => {
    const f = await paid();
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_dup", "checkout.session.completed"); // duplicate webhook
    let l = await ledger(f.store, "test-var-jelly-blue");
    expect(l.entries[CHECKOUT_ID]).toMatchObject({ state: "sold", quantity: 2 });
    expect(availableUnits(5, l, SEC)).toBe(3);

    const t = { carrier: "USPS", trackingNumber: "9400111111111111111111", trackingUrl: "" };
    await markShipped(f.store, SESSION_ID, "in_house-1", t, NOW, catalog);
    await markShipped(f.store, SESSION_ID, "in_house-1", { ...t, trackingNumber: "9400222222222222222222" }, NOW, catalog); // tracking updated
    l = await ledger(f.store, "test-var-jelly-blue");
    expect(l.onHand).toBe(3); // 5 − 2, once
    expect(l.entries[CHECKOUT_ID]).toBeUndefined(); // no longer "waiting to ship"
    expect(availableUnits(5, l, SEC)).toBe(3); // free units unchanged by shipping
    expect(l.recent!.filter((a) => a.kind === "website-shipped")).toHaveLength(1);
    expect(l.recent![0]).toMatchObject({ source: "website", orderId: (await reload(f)).id, delta: -2 });
  });

  it("a replacement shipment takes another unit; the lost one isn't added back", async () => {
    const f = await paid();
    const t = { carrier: "USPS", trackingNumber: "9400111111111111111111", trackingUrl: "" };
    await markShipped(f.store, SESSION_ID, "in_house-1", t, NOW, catalog);
    await markLost(f.store, SESSION_ID, "in_house-1", NOW);
    await reshipPackage(f.store, SESSION_ID, "in_house-1", NOW);
    await markShipped(f.store, SESSION_ID, "in_house-1", { ...t, trackingNumber: "9400333333333333333333" }, NOW, catalog);
    expect((await ledger(f.store, "test-var-jelly-blue")).onHand).toBe(1); // 5 − 2 − 2
  });

  it("refunds never change stock by themselves (after shipping: put returns back by hand)", async () => {
    const f = await paid();
    await markShipped(f.store, SESSION_ID, "in_house-1", { carrier: "USPS", trackingNumber: "9400111111111111111111", trackingUrl: "" }, NOW, catalog);
    const before = (await ledger(f.store, "test-var-jelly-blue")).onHand;
    await refundOrder(fakeStripe(), f.store, SESSION_ID, 500);
    await recordRefund("pi_test_123", 500, f.deps, "evt_r1");
    await recordRefund("pi_test_123", 2250, f.deps, "evt_r2"); // full refund after shipping
    expect((await ledger(f.store, "test-var-jelly-blue")).onHand).toBe(before);
  });

  it("a full refund before anything shipped frees the units (once)", async () => {
    const f = await paid();
    await recordRefund("pi_test_123", 2250, f.deps, "evt_r1");
    await recordRefund("pi_test_123", 2250, f.deps, "evt_r1b");
    expect(availableUnits(5, await getLedger(f.store, "test-var-jelly-blue"), SEC)).toBe(5);
    expect(availableUnits(3, await getLedger(f.store, "test-var-supplier-mint"), SEC)).toBe(3);
  });

  it("canceling a package frees its units once, even if repeated", async () => {
    const f = fakeDeps(snapshot({
      shippingPlan: [
        { groupId: "test-studio", source: "in_house", cents: 250, processingBusinessDays: 2, militaryAddresses: true },
        { groupId: "test-supplier-a", source: "supplier", cents: 250, processingBusinessDays: 3, militaryAddresses: true },
      ],
      lineItems: snapshot().lineItems.map((l) => ({ ...l, fulfillmentOrigin: l.fulfillmentSource === "supplier" ? "test-supplier-a" : "test-studio" })),
    }));
    await fulfillCheckoutSession(SESSION_ID, f.deps, "evt_1", "checkout.session.completed");
    const stripe = fakeStripe();
    await cancelPackage(stripe, f.store, SESSION_ID, "test-studio");
    await cancelPackage(stripe, f.store, SESSION_ID, "test-studio");
    expect(availableUnits(5, await getLedger(f.store, "test-var-jelly-blue"), SEC)).toBe(5);
  });

  it("finds and releases units still reserved for canceled orders", async () => {
    const f = await paid();
    const o = await reload(f);
    o.status = "canceled"; // e.g. canceled before this check existed
    await f.store.replace(orderKey(SESSION_ID), o, (await f.store.get(orderKey(SESSION_ID)))!.etag);
    const item: StockItem = { variantId: "test-var-jelly-blue", productId: "p", sku: "J", productName: "Jelly", variantName: "Blue", published: true, websiteSellable: true, supplier: false };
    const row = stockRow(item, await getLedger(f.store, "test-var-jelly-blue"), 5, { now: NOW, canceledCheckouts: canceledCheckouts([o]) });
    expect(row.warnings.map((w) => w.code)).toContain("reserved-for-canceled");
    expect(await releaseCanceled(f.store, [o], "test-var-jelly-blue")).toBe(2);
    expect(availableUnits(5, await getLedger(f.store, "test-var-jelly-blue"), SEC)).toBe(5);
  });
});

describe("warnings", () => {
  const item: StockItem = { variantId: "a", productId: "p", sku: "SKU-A", productName: "Jelly", variantName: "Blue", published: true, websiteSellable: true, supplier: false };
  const codes = (l: VariantLedger | null, catalogOnHand: number | null = 5, extra: Partial<Parameters<typeof stockRow>[3]> = {}) =>
    stockRow(item, l, catalogOnHand, { now: NOW, ...extra }).warnings.map((w) => w.code);

  it("low, sold out and oversold", async () => {
    const s = new MemoryKvStore();
    expect(codes(null, 2)).toContain("low");
    expect(codes(null, 0)).toContain("sold-out");
    await reserveStock(s, "c", [{ variantId: "a", quantity: 2, onHand: 2 }], EXP, SEC);
    await commitStock(s, "c", [{ variantId: "a", quantity: 2, onHand: 2 }], SEC);
    await adj(s, { kind: "tiktok-sale", quantity: 1, catalogOnHand: 2, force: true });
    expect(codes(await getLedger(s, "a"), 2)).toContain("oversold");
  });

  it("warns when an item is on both channels with only a few left", async () => {
    const s = new MemoryKvStore();
    await setTikTokListed(s, "a", true);
    expect(codes(await getLedger(s, "a"), 4)).toContain("both-channels-low");
    expect(codes(await getLedger(s, "a"), 20)).not.toContain("both-channels-low");
    expect(stockRow({ ...item, websiteSellable: false }, await getLedger(s, "a"), 4, { now: NOW }).warnings.map((w) => w.code)).not.toContain("both-channels-low");
    expect(codes(null, 4, { liveVariantIds: new Set(["a"]) })).toContain("both-channels-low"); // featured in a LIVE
    await setPaused(s, ["a"], true, "", "owner", NOW);
    expect(codes(await getLedger(s, "a"), 4)).not.toContain("both-channels-low"); // already paused
  });

  it("reminds about long pauses and missing counts", async () => {
    const s = new MemoryKvStore();
    await setPaused(s, ["a"], true, "LIVE", "owner", new Date(NOW.getTime() - 2 * 86_400_000));
    expect(codes(await getLedger(s, "a"))).toEqual(expect.arrayContaining(["paused-long", "not-counted-recently"]));
    expect(codes(null, null)).toContain("no-count");
  });
});
