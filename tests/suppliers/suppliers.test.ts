import { describe, expect, it } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { orderKey } from "@/commerce/orders/fulfill";
import { markShipped } from "@/commerce/orders/admin";
import { addSupplierException, claimTracking, placeWithSupplier, resolveSupplierException, supplierAttention, supplierCanceled, supplierUpdate } from "@/commerce/orders/supplier-orders";
import { applySupplierForm, createSupplier, mayShareCustomerData, newSupplier, saveSupplier } from "@/commerce/suppliers/supplier";
import { estimatedMargin, offers, supplierFacts } from "@/commerce/suppliers/compare";
import { capabilityStates } from "@/commerce/suppliers/integrations";
import { checkDocument, cleanName } from "@/commerce/suppliers/documents";
import { packagesFor, supplierCsv } from "@/commerce/suppliers/export";
import { order } from "../owner/factory";
import { completeRecord } from "../products/fixtures";
import type { Order } from "@/commerce/orders/types";

/* All suppliers, customers and orders here are fictional. */

function signed() {
  const s = newSupplier("Mock Supplier Co");
  s.status = "approved";
  s.agreement = { status: "signed", signedOn: "2026-10-01", renewOn: null, reference: "test", coversCustomerData: true, coversShipTimes: true, coversRates: true };
  return s;
}

async function withOrder(o: Order) {
  const store = new MemoryKvStore();
  await store.create(orderKey(o.stripeCheckoutSessionId), o);
  return store;
}
const supplierOrder = (over: Partial<Order> = {}) => order({ id: "FS-T-SUP-1", ...over }, [{ id: "g1", source: "supplier", origin: "supplier-a", status: "awaiting_supplier", shipBy: "2026-11-06" }]);

describe("supplier records", () => {
  it("validates the form on the server", () => {
    const s = newSupplier("Mock");
    expect(applySupplierForm(s, { name: "", website: "javascript:alert(1)", moq: "lots", c0email: "nope" })).toMatch(/Name is required[\s\S]*Website[\s\S]*moq[\s\S]*email/);
    expect(applySupplierForm(s, { name: "Mock", agreementStatus: "signed" })).toMatch(/signing date/);
  });

  it("agreement coverage ticks only count for a signed agreement", () => {
    const r = applySupplierForm(newSupplier("Mock"), { name: "Mock", agreementStatus: "draft", coversCustomerData: "on" });
    expect(typeof r !== "string" && r.agreement.coversCustomerData).toBe(false);
  });

  it("refuses duplicate names and stale saves", async () => {
    const store = new MemoryKvStore();
    const a = await createSupplier(store, "Mock Supplier");
    expect(a.ok).toBe(true);
    expect(await createSupplier(store, "mock supplier")).toMatchObject({ ok: false });
    if (!a.ok) return;
    expect((await saveSupplier(store, a.supplier.id, 1, (s) => ({ ...s, notes: "x" }))).ok).toBe(true);
    expect(await saveSupplier(store, a.supplier.id, 1, (s) => ({ ...s, notes: "y" }))).toMatchObject({ ok: false });
  });

  it("customer details may only go to a supplier under a signed agreement covering them", () => {
    expect(mayShareCustomerData(newSupplier("x"))).toMatchObject({ ok: false });
    const s = signed();
    expect(mayShareCustomerData(s)).toEqual({ ok: true });
    expect(mayShareCustomerData({ ...s, agreement: { ...s.agreement, coversCustomerData: false } })).toMatchObject({ ok: false });
    expect(mayShareCustomerData({ ...s, agreement: { ...s.agreement, renewOn: "2026-01-01" } }, new Date("2026-11-01"))).toMatchObject({ ok: false });
    expect(mayShareCustomerData({ ...s, status: "paused" })).toMatchObject({ ok: false });
  });

  it("every automation stays off with no reviewed adapter and no approval", () => {
    const states = capabilityStates(signed(), {});
    expect(states.find((c) => c.capability === "order-api")).toMatchObject({ enabled: false });
    expect(states.filter((c) => c.capability !== "csv-order-export").every((c) => !c.enabled)).toBe(true);
    expect(states.find((c) => c.capability === "csv-order-export")?.enabled).toBe(true); // manual download, still gated per download
    expect(capabilityStates(newSupplier("x"), {}).every((c) => !c.enabled)).toBe(true);
  });
});

describe("manual supplier order workflow", () => {
  const input = { supplierId: "s_mock123", reference: "PO-10001", expectedShipBy: "2026-11-05" };

  it("records the supplier order once; the same form twice is fine, a second reference is refused", async () => {
    const o = supplierOrder();
    const store = await withOrder(o);
    const r = await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input);
    expect(r.ok && r.order.fulfillments[0]).toMatchObject({ status: "sent_to_supplier", supplierRef: "PO-10001", supplierOrder: { status: "placed" } });
    expect((await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input)).ok).toBe(true);
    expect(await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", { ...input, reference: "PO-99999" })).toMatchObject({ ok: false, error: expect.stringMatching(/already placed/) });
  });

  it("the same supplier reference can't be recorded on two orders (duplicate supplier order)", async () => {
    const a = supplierOrder({ id: "FS-T-A", stripeCheckoutSessionId: "cs_test_aaaaaaaaaaaa" });
    const b = supplierOrder({ id: "FS-T-B", stripeCheckoutSessionId: "cs_test_bbbbbbbbbbbb" });
    const store = await withOrder(a);
    await store.create(orderKey(b.stripeCheckoutSessionId), b);
    expect((await placeWithSupplier(store, a.stripeCheckoutSessionId, "g1", input)).ok).toBe(true);
    expect(await placeWithSupplier(store, b.stripeCheckoutSessionId, "g1", { ...input, reference: " po-10001 " })).toMatchObject({ ok: false, error: expect.stringMatching(/duplicate/) });
  });

  it("two tabs recording at the same moment: exactly one wins", async () => {
    const o = supplierOrder();
    const store = await withOrder(o);
    const [x, y] = await Promise.all([placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input), placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", { ...input, reference: "PO-20002" })]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
    expect((await store.list("supplier-ref/")).length).toBe(1); // the loser's reference was given back
  });

  it.each([
    ["a canceled order", { status: "canceled" as const }],
    ["an unpaid order", { paymentStatus: "processing" as const, status: "awaiting_payment" as const }],
    ["a fully refunded order", { paymentStatus: "refunded" as const }],
  ])("refuses to place %s", async (_label, over) => {
    const o = supplierOrder(over);
    const store = await withOrder(o);
    expect((await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input)).ok).toBe(false);
    expect(await store.list("supplier-ref/")).toEqual([]);
  });

  it("refuses our own packages and bad references", async () => {
    const o = order({}, [{ id: "g1" }]);
    const store = await withOrder(o);
    expect(await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input)).toMatchObject({ ok: false, error: expect.stringMatching(/own stock/) });
    expect(await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", { ...input, reference: "<script>" })).toMatchObject({ ok: false });
  });

  it("problems, updates, resolution and cancellation are tracked; cancellation frees the reference", async () => {
    const o = supplierOrder();
    const store = await withOrder(o);
    await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input);
    const p = await addSupplierException(store, o.stripeCheckoutSessionId, "g1", "out-of-stock", "Pink is out until next week");
    expect(p.ok && p.order.fulfillments[0].supplierOrder?.status).toBe("problem");
    expect(supplierAttention([p.ok ? p.order : o]).map((x) => x.why)).toEqual(["Supplier problem: out of stock"]);
    const id = p.ok ? p.order.fulfillments[0].supplierOrder!.exceptions[0].id : "";
    expect((await resolveSupplierException(store, o.stripeCheckoutSessionId, "g1", id)).ok).toBe(true);
    expect((await supplierUpdate(store, o.stripeCheckoutSessionId, "g1", "processing", null, null)).ok).toBe(true);
    const c = await supplierCanceled(store, o.stripeCheckoutSessionId, "g1");
    expect(c.ok && c.order.fulfillments[0]).toMatchObject({ status: "awaiting_supplier", supplierRef: null });
    expect(await store.list("supplier-ref/")).toEqual([]);
  });

  it("a tracking number belongs to one package: refused on another order", async () => {
    const store = new MemoryKvStore();
    expect(await claimTracking(store, "9400 1000 0000 0000 0001", "cs_test_aaaaaaaaaaaa", "g1", "FS-T-A")).toEqual({ ok: true });
    expect(await claimTracking(store, "94001000000000000001", "cs_test_aaaaaaaaaaaa", "g1", "FS-T-A")).toEqual({ ok: true });
    expect(await claimTracking(store, "94001000000000000001", "cs_test_bbbbbbbbbbbb", "g1", "FS-T-B")).toMatchObject({ ok: false, error: expect.stringMatching(/FS-T-A/) });
  });

  it("marking a supplier package shipped closes its supplier order", async () => {
    const o = supplierOrder();
    const store = await withOrder(o);
    await placeWithSupplier(store, o.stripeCheckoutSessionId, "g1", input);
    const r = await markShipped(store, o.stripeCheckoutSessionId, "g1", { carrier: "USPS", trackingNumber: "9400100000000000000001", trackingUrl: "" });
    expect(r.ok && r.order.fulfillments[0].supplierOrder?.status).toBe("shipped");
  });

  it("a late supplier shows up as needing attention", () => {
    const o = supplierOrder();
    o.fulfillments[0].status = "sent_to_supplier";
    o.fulfillments[0].supplierOrder = { supplierId: "s_mock123", reference: "PO-1", placedAt: "2026-11-01", status: "placed", expectedShipBy: "2026-11-03", exceptions: [], updates: [] };
    expect(supplierAttention([o], new Date("2026-11-05T12:00:00Z"))[0].why).toMatch(/no tracking yet/);
  });
});

describe("supplier documents", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("accepts PDF, images and CSV price lists; refuses Office files, HTML, archives", () => {
    expect(checkDocument(enc("%PDF-1.7\n%test"))).toMatchObject({ ok: true, contentType: "application/pdf" });
    expect(checkDocument(enc("sku,price\nA,1.20\n"))).toMatchObject({ ok: true, contentType: "text/csv; charset=utf-8" });
    expect(checkDocument(enc("<html><script>alert(1)</script>,</html>")).ok).toBe(false);
    expect(checkDocument(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 6, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0])).ok).toBe(false); // .docx/.xlsx/.zip
    expect(checkDocument(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0])).ok).toBe(false); // old .doc/.xls
  });
  it("cleans display names", () => {
    expect(cleanName('../../etc/"passwd".pdf')).toBe("_.._etc_passwd_.pdf");
  });
});

describe("comparison uses only entered facts", () => {
  it("lists what's missing instead of guessing", () => {
    expect(supplierFacts(newSupplier("x"), []).missing).toEqual(expect.arrayContaining(["minimum order", "processing time", "shipping cost", "agreement (none)"]));
  });

  it("margins are estimates from your own numbers, and need both numbers", () => {
    expect(estimatedMargin({ priceCents: 1200, unitCostCents: 300, landedCostCents: null })).toEqual({ margin: 0.75, basis: "unit" });
    expect(estimatedMargin({ priceCents: 1200, unitCostCents: 300, landedCostCents: 600 })).toEqual({ margin: 0.5, basis: "landed" });
    expect(estimatedMargin({ priceCents: null, unitCostCents: 300, landedCostCents: null })).toBeNull();
    expect(estimatedMargin({ priceCents: 1200, unitCostCents: null, landedCostCents: null })).toBeNull();
  });

  it("links SKUs to suppliers and includes quotes with a planned price", () => {
    const s = signed();
    s.quotes = [{ id: "q1", product: "Jelly cube", supplierSku: "JC-1", productType: "jelly", unitCostCents: 250, landedCostCents: null, moq: 100, receivedOn: null, source: "price list" }];
    const r = completeRecord();
    r.private.variants[r.product.variants[0].id].supplierId = s.id;
    const list = offers([s], [r], 999);
    expect(list.map((o) => o.kind).sort()).toEqual(["linked", "quote"]);
    expect(list.find((o) => o.kind === "quote")).toMatchObject({ priceCents: 999, priceIsPlanned: true });
  });
});

describe("supplier CSV export", () => {
  it("has only what a supplier needs to ship: no email, prices or totals", () => {
    const s = signed();
    const r = completeRecord();
    const o = supplierOrder();
    o.lineItems[0].variantId = r.product.variants[0].id;
    o.fulfillments[0].variantIds = [r.product.variants[0].id];
    r.private.variants[r.product.variants[0].id].supplierId = s.id;
    r.private.variants[r.product.variants[0].id].supplierSku = "SUP-SKU-9";
    const pkgs = packagesFor(s, [o], [r], [s]);
    expect(pkgs).toHaveLength(1);
    const csv = supplierCsv(pkgs, { includePhone: false });
    expect(csv).toMatch(/SUP-SKU-9/);
    expect(csv).toMatch(/Fictional Buyer/);
    expect(csv).not.toMatch(/fictional\.buyer@example\.com|pi_test|1000|2500/);
    expect(csv.split("\n")[0]).not.toMatch(/phone|email|price|total/);
  });

  it("never includes canceled or unpaid orders", () => {
    const s = signed();
    expect(packagesFor(s, [supplierOrder({ status: "canceled" }), supplierOrder({ paymentStatus: "failed" })], [], [{ ...s, originId: "supplier-a" }])).toEqual([]);
  });
});
