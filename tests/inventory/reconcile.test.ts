import { describe, expect, it } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { adjustStock } from "@/commerce/orders/stock-admin";
import { getLedger } from "@/commerce/orders/inventory";
import { applyTikTok, getSupplierStock, lastTikTokReconcile, parseCounts, parseTikTokOrders, planTikTok, setSupplierStock, stableId, supplierStockStale } from "@/commerce/orders/reconcile";

/* Fictional SKUs and TikTok order numbers only. */
const item = (sku: string, supplier = false) => ({ variantId: `v-${sku.toLowerCase()}`, productId: "p1", sku, productName: "Test", variantName: sku, published: true, websiteSellable: true, supplier, catalogOnHand: null as number | null });
const ITEMS = [item("TEST-A"), item("TEST-B")];

async function stocked(units = 10) {
  const s = new MemoryKvStore();
  for (const i of ITEMS) await adjustStock(s, { variantId: i.variantId, sku: i.sku, kind: "count", quantity: units, requestId: stableId("seed", i.sku), catalogOnHand: null });
  return s;
}
const onHand = async (s: MemoryKvStore, sku: string) => (await getLedger(s, `v-${sku.toLowerCase()}`))?.onHand;

const CSV = `Order ID,Order Status,Seller SKU,Quantity,Created Time
'577000000000000001,Shipped,TEST-A,2,2026-11-01 10:00
577000000000000002,Awaiting shipment,TEST-B,1,2026-11-01 11:00
577000000000000002,Awaiting shipment,TEST-B,1,2026-11-01 11:00
577000000000000003,Canceled,TEST-A,5,2026-11-01 12:00
577000000000000004,Shipped,UNKNOWN-SKU,1,2026-11-01 13:00
`;

describe("TikTok Shop order export", () => {
  it("reads TikTok's column names, strips spreadsheet quotes and merges split lines", () => {
    const r = parseTikTokOrders(CSV);
    expect(r.errors).toEqual([]);
    expect(r.lines.map((l) => [l.orderId, l.sku, l.quantity, l.canceled])).toEqual([
      ["577000000000000001", "TEST-A", 2, false],
      ["577000000000000002", "TEST-B", 2, false],
      ["577000000000000003", "TEST-A", 5, true],
      ["577000000000000004", "UNKNOWN-SKU", 1, false],
    ]);
  });

  it("names missing columns instead of guessing", () => {
    expect(parseTikTokOrders("id,product\n1,x\n").missingColumns).toEqual(["order id", "seller sku", "quantity"]);
  });

  it("records each sale once; uploading the same (or an overlapping) file again changes nothing", async () => {
    const s = await stocked();
    const lines = parseTikTokOrders(CSV).lines;
    const plan = await planTikTok(s, lines, ITEMS);
    expect(plan.map((p) => p.action)).toEqual(["record-sale", "record-sale", "canceled-not-recorded", "unknown-sku"]);
    const out = await applyTikTok(s, plan);
    expect(out.filter((o) => o.result === "applied")).toHaveLength(2);
    expect([await onHand(s, "TEST-A"), await onHand(s, "TEST-B")]).toEqual([8, 8]);
    const again = await planTikTok(s, lines, ITEMS);
    expect(again.map((p) => p.action)).toEqual(["already-recorded", "already-recorded", "canceled-not-recorded", "unknown-sku"]);
    await applyTikTok(s, again);
    expect([await onHand(s, "TEST-A"), await onHand(s, "TEST-B")]).toEqual([8, 8]);
    expect((await lastTikTokReconcile(s))?.applied).toBe(0);
  });

  it("two uploads at the same moment still count each line once", async () => {
    const s = await stocked();
    const lines = parseTikTokOrders(CSV).lines;
    const [p1, p2] = await Promise.all([planTikTok(s, lines, ITEMS), planTikTok(s, lines, ITEMS)]);
    await Promise.all([applyTikTok(s, p1), applyTikTok(s, p2)]);
    expect([await onHand(s, "TEST-A"), await onHand(s, "TEST-B")]).toEqual([8, 8]);
  });

  it("a late cancellation puts the units back exactly once", async () => {
    const s = await stocked();
    await applyTikTok(s, await planTikTok(s, parseTikTokOrders("Order ID,Seller SKU,Quantity,Order Status\n900000001,TEST-A,3,Shipped\n").lines, ITEMS));
    expect(await onHand(s, "TEST-A")).toBe(7);
    const canceled = parseTikTokOrders("Order ID,Seller SKU,Quantity,Order Status\n900000001,TEST-A,3,Canceled\n").lines;
    const plan = await planTikTok(s, canceled, ITEMS);
    expect(plan[0].action).toBe("put-back");
    await applyTikTok(s, plan);
    await applyTikTok(s, await planTikTok(s, canceled, ITEMS));
    expect(await onHand(s, "TEST-A")).toBe(10);
  });

  it("a changed quantity is flagged for you, not applied", async () => {
    const s = await stocked();
    await applyTikTok(s, await planTikTok(s, parseTikTokOrders("Order ID,Seller SKU,Quantity\n900000002,TEST-B,1\n").lines, ITEMS));
    const plan = await planTikTok(s, parseTikTokOrders("Order ID,Seller SKU,Quantity\n900000002,TEST-B,4\n").lines, ITEMS);
    expect(plan[0].action).toBe("quantity-changed");
    expect((await applyTikTok(s, plan))[0].result).toBe("skipped");
    expect(await onHand(s, "TEST-B")).toBe(9);
  });

  it("a sale that would go below zero is held (not counted) and can be uploaded again later", async () => {
    const s = await stocked(1);
    const lines = parseTikTokOrders("Order ID,Seller SKU,Quantity\n900000003,TEST-A,2\n").lines;
    const out = await applyTikTok(s, await planTikTok(s, lines, ITEMS));
    expect(out[0]).toMatchObject({ result: "held" });
    expect(await onHand(s, "TEST-A")).toBe(1);
    expect((await planTikTok(s, lines, ITEMS))[0].action).toBe("record-sale"); // not marked done
  });
});

describe("shelf counts upload", () => {
  it("parses sku,count and rejects bad rows", () => {
    expect(parseCounts("sku,count,note\nTEST-A,12,top shelf\n").rows).toEqual([{ line: 2, sku: "TEST-A", count: 12, note: "top shelf" }]);
    expect(parseCounts("sku,count\nTEST-A,-3\nTEST-B,lots\n").errors).toHaveLength(2);
  });
});

describe("supplier stock", () => {
  it("out of stock pauses the item on the website; old checks are stale", async () => {
    const s = await stocked();
    const r = await setSupplierStock(s, { variantId: "v-test-a", state: "out", quantity: 0, note: null }, new Date("2026-11-01T00:00:00Z"));
    expect(r.paused).toBe(true);
    expect((await getLedger(s, "v-test-a"))?.paused).toMatchObject({ reason: "Supplier: out of stock" });
    const st = await getSupplierStock(s, "v-test-a");
    expect(supplierStockStale(st, new Date("2026-11-03T00:00:00Z"))).toBe(false);
    expect(supplierStockStale(st, new Date("2026-11-10T00:00:00Z"))).toBe(true);
    expect(supplierStockStale(null)).toBe(true);
  });
});

it("stable ids look like UUIDs (the stock ledger's request-id format) and repeat for the same input", () => {
  expect(stableId("a", "b")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(stableId("a", "b")).toBe(stableId("a", "b"));
  expect(stableId("a", "b")).not.toBe(stableId("ab"));
});
