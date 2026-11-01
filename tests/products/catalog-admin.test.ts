import { describe, expect, it } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { validateProducts } from "@/commerce/validate";
import { newRecord, parseBasics, parseVariant, toPublicProduct, upsertVariant } from "@/commerce/catalog-admin/record";
import { productReadiness } from "@/commerce/catalog-admin/readiness";
import { currentRelease, listReleases, liveDiffers, makeRelease, publishProduct, recordKey, rollbackTo, saveRecord, unpublishProduct } from "@/commerce/catalog-admin/store";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { completeRecord, ctx } from "./fixtures";

async function seed(...records: ReturnType<typeof completeRecord>[]) {
  const s = new MemoryKvStore();
  for (const r of records) await s.create(recordKey(r.id), r);
  return s;
}

describe("form parsing (server-side validation)", () => {
  it("accepts a sensible variant and converts dollars to cents", () => {
    const r = parseVariant({ sku: "fs-berry-1", variantName: "Pink", swatch: "#FF7AB8", price: "$12.99", cost: "3.10", tracked: "on", available: "25", weightGrams: "120", lengthCm: "10", widthCm: "8", heightCm: "6.5" });
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.value).toMatchObject({ sku: "FS-BERRY-1", priceCents: 1299, available: 25, dimensions: { lengthCm: 10, widthCm: 8, heightCm: 6.5 } });
    expect(r.value.private.costCents).toBe(310);
  });

  it("refuses bad money, fake was-prices, half box sizes and supplier items with no origin", () => {
    const bad = parseVariant({ sku: "X", variantName: "", price: "12.999", compareAt: "5", lengthCm: "10", fulfillmentSource: "supplier" });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    const all = bad.errors.join(" ");
    expect(all).toMatch(/SKU/);
    expect(all).toMatch(/Variant name/);
    expect(all).toMatch(/Price: dollars and cents/);
    expect(all).toMatch(/was-price needs its basis/);
    expect(all).toMatch(/all three sides/);
    expect(all).toMatch(/shipping origin/);
    expect(parseVariant({ sku: "OK-1", variantName: "A", price: "10", compareAt: "9", compareAtBasis: "x" })).toMatchObject({ ok: false });
  });

  it("verified ticks only count when there's something to verify", () => {
    const r = parseVariant({ sku: "OK-1", variantName: "A", costVerified: "on", priceVerified: "on" });
    expect(r.ok && r.value.private).toMatchObject({ costVerified: false, priceVerified: false });
  });

  it("basics need a name, a valid web address and a category", () => {
    expect(parseBasics({ name: "", slug: "Bad Slug", category: "nope" })).toMatchObject({ ok: false });
    expect(parseBasics({ name: "Berry", slug: "berry", category: "jelly-squishies", featuredRank: "5" })).toMatchObject({ ok: true, value: { featuredRank: 5 } });
  });

  it("rejects duplicate SKUs inside one product", () => {
    const r = newRecord({ name: "A", slug: "a", category: "jelly-squishies" });
    const v = parseVariant({ sku: "DUP-1", variantName: "One" });
    if (!v.ok) throw new Error();
    const first = upsertVariant(r, v.value);
    if (!first.ok) throw new Error(first.error);
    expect(upsertVariant(first.record, { ...v.value, name: "Two" })).toMatchObject({ ok: false });
  });
});

describe("public/private separation", () => {
  it("a release product has no private fields and passes the public catalog validator", () => {
    const r = completeRecord();
    r.private.notes = "secret supplier note";
    r.private.variants[r.product.variants[0].id].supplierSku = "SUP-123";
    const pub = toPublicProduct({ ...r, status: "published" });
    const json = JSON.stringify(pub);
    expect(json).not.toMatch(/cost|supplier"|supplierSku|SUP-123|secret|invoice|compliance|cpc/i);
    expect(() => validateProducts([pub])).not.toThrow();
  });
});

describe("launch-readiness checklist", () => {
  it("a new draft fails every item and lists what's missing", () => {
    const res = productReadiness(newRecord({ name: "New", slug: "new", category: "jelly-squishies" }), ctx());
    expect(res.ready).toBe(false);
    expect(res.items.filter((i) => !i.ok).map((i) => i.id)).toEqual(expect.arrayContaining(["basics", "variants", "photos", "age", "warnings", "maker", "compliance"]));
  });

  it("a complete product passes", () => {
    expect(productReadiness(completeRecord(), ctx()).ready).toBe(true);
  });

  it("fails with the REAL shipping table, which has no verified rates yet", () => {
    const res = productReadiness(completeRecord(), ctx({ origins: SHIPPING_ORIGINS }));
    expect(res.ready).toBe(false);
    expect(res.items.find((i) => i.id === "shipping")?.missing.join(" ")).toMatch(/No verified shipping rates/);
  });

  it.each([
    ["compliance", (r: ReturnType<typeof completeRecord>) => (r.private.compliance.status = "received")],
    ["photos", (r: ReturnType<typeof completeRecord>) => (r.private.photosAuthentic = false)],
    ["costs", (r: ReturnType<typeof completeRecord>) => (r.private.variants[r.product.variants[0].id].costVerified = false)],
    ["prices", (r: ReturnType<typeof completeRecord>) => (r.private.variants[r.product.variants[0].id].priceVerified = false)],
    ["age", (r: ReturnType<typeof completeRecord>) => (r.product.safety.ageGrade = null)],
    ["inventory", (r: ReturnType<typeof completeRecord>) => (r.product.variants[0].inventory = { tracked: false, available: null })],
    ["shipping", (r: ReturnType<typeof completeRecord>) => (r.private.shippingMeasured = false)],
  ])("one gap (%s) blocks publishing", (id, mutate) => {
    const r = completeRecord();
    mutate(r);
    const res = productReadiness(r, ctx());
    expect(res.ready).toBe(false);
    expect(res.items.find((i) => i.id === id)?.ok).toBe(false);
  });

  it("supplier-shipped variants need a linked, existing supplier and its SKU", () => {
    const r = completeRecord();
    r.product.variants[0].fulfillmentSource = "supplier";
    r.product.variants[0].fulfillmentOrigin = "supplier-a";
    const res = productReadiness(r, ctx());
    expect(res.items.find((i) => i.id === "fulfillment")?.missing.join(" ")).toMatch(/no supplier linked/);
    r.private.variants[r.product.variants[0].id].supplierId = "s_gone";
    expect(productReadiness(r, ctx()).items.find((i) => i.id === "fulfillment")?.missing.join(" ")).toMatch(/no longer exists/);
  });

  it("a SKU used by another product blocks publishing", () => {
    const res = productReadiness(completeRecord(), ctx({ otherSkus: new Map([["TEST-FICT-1", "Other"]]) }));
    expect(res.items.find((i) => i.id === "variants")?.ok).toBe(false);
  });
});

describe("saving and publishing", () => {
  it("refuses a save from an out-of-date form (two tabs)", async () => {
    const r = completeRecord();
    const s = await seed(r);
    const first = await saveRecord(s, r.id, 1, "Tab A", (x) => ({ ok: true, record: { ...x, product: { ...x.product, name: "A" } } }));
    expect(first.ok).toBe(true);
    const second = await saveRecord(s, r.id, 1, "Tab B", (x) => ({ ok: true, record: { ...x, product: { ...x.product, name: "B" } } }));
    expect(second).toMatchObject({ ok: false, conflict: true });
  });

  it("won't publish a product that fails the checklist", async () => {
    const r = completeRecord();
    r.private.compliance.status = "requested";
    const s = await seed(r);
    const res = await publishProduct(s, r.id, r.rev, ctx());
    expect(res.ok).toBe(false);
    expect(await currentRelease(s)).toBeNull();
  });

  it("publishes, then publishes another, then unpublishes — each a new numbered release", async () => {
    const a = completeRecord("Test A", "test-a", "TEST-A");
    const b = completeRecord("Test B", "test-b", "TEST-B");
    const s = await seed(a, b);
    const p1 = await publishProduct(s, a.id, 1, ctx());
    expect(p1).toMatchObject({ ok: true, release: { seq: 1 } });
    const p2 = await publishProduct(s, b.id, 1, ctx());
    expect(p2.ok && p2.release.products.map((p) => p.slug).sort()).toEqual(["test-a", "test-b"]);
    const recA = (await s.get<ReturnType<typeof completeRecord>>(recordKey(a.id)))!.value;
    expect(recA.status).toBe("published");
    const u = await unpublishProduct(s, a.id, recA.rev, "archived");
    expect(u.ok && u.release.products.map((p) => p.slug)).toEqual(["test-b"]);
    expect((await listReleases(s)).map((r) => r.seq)).toEqual([3, 2, 1]);
  });

  it("edits to a published product stay off the website until published again", async () => {
    const a = completeRecord();
    const s = await seed(a);
    await publishProduct(s, a.id, 1, ctx());
    const rec = (await s.get<ReturnType<typeof completeRecord>>(recordKey(a.id)))!.value;
    const edited = await saveRecord(s, a.id, rec.rev, "Rename", (x) => ({ ok: true, record: { ...x, product: { ...x.product, name: "Renamed" } } }));
    if (!edited.ok) throw new Error(edited.error);
    const live = await currentRelease(s);
    expect(live?.products[0].name).toBe("Fictional Test Squishy");
    expect(liveDiffers(edited.record, live)).toBe(true);
  });

  it("two publishes at the same moment both land, in separate releases", async () => {
    const a = completeRecord("Test A", "test-a", "TEST-A");
    const b = completeRecord("Test B", "test-b", "TEST-B");
    const s = await seed(a, b);
    const [x, y] = await Promise.all([publishProduct(s, a.id, 1, ctx()), publishProduct(s, b.id, 1, ctx())]);
    expect(x.ok && y.ok).toBe(true);
    const live = await currentRelease(s);
    expect(live?.seq).toBe(2);
    expect(live?.products.map((p) => p.slug).sort()).toEqual(["test-a", "test-b"]);
  });

  it("rollback shows an older catalog again as a new release, and records follow", async () => {
    const a = completeRecord("Test A", "test-a", "TEST-A");
    const b = completeRecord("Test B", "test-b", "TEST-B");
    const s = await seed(a, b);
    await publishProduct(s, a.id, 1, ctx());
    await publishProduct(s, b.id, 1, ctx());
    const r = await rollbackTo(s, 1);
    expect(r).toMatchObject({ ok: true, release: { seq: 3, change: "Rolled back to release 1" } });
    expect((await currentRelease(s))?.products.map((p) => p.slug)).toEqual(["test-a"]);
    expect((await s.get<ReturnType<typeof completeRecord>>(recordKey(b.id)))!.value.status).toBe("draft");
  });

  it("refuses a release that wouldn't pass the public validator", async () => {
    const s = new MemoryKvStore();
    const bad = toPublicProduct({ ...completeRecord(), status: "published" });
    bad.media = [{ type: "image", src: "https://hotlinked.example/img.jpg", alt: "hotlinked", width: 1, height: 1 }];
    expect(await makeRelease(s, "bad", () => [bad])).toMatchObject({ ok: false });
    expect(await currentRelease(s)).toBeNull();
  });
});
