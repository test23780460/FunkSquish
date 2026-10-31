import { describe, expect, it } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { SHIPPING_ORIGINS, validateOrigins } from "@/commerce/origins";
import { draftFrom, draftStatus, exportJson, loadDraft, parseOrigin, parseTiers, previewQuote, publicTable, saveDraft } from "@/commerce/shipping-admin";

/* Example rates only — none of these are FunkSquish's real rates. */
const NOW = new Date("2026-11-02T12:00:00Z");
const base = { publicLabel: "a FunkSquish supplier partner", ruleKind: "per-item", firstItem: "4.50", additionalItem: "1.00", maxItems: "5", processingBusinessDays: "5", reviewEveryDays: "90" };

describe("shipping origin form", () => {
  it("accepts a sensible supplier origin", () => {
    const o = parseOrigin({ ...base, id: "supplier-a", source: "supplier", agreementOnFile: "on" }, { supplierNames: ["Mock Toys Ltd"], existing: null, now: NOW });
    expect(o).toMatchObject({ id: "supplier-a", rule: { kind: "per-item", firstItemCents: 450, additionalItemCents: 100, maxItemsPerPackage: 5 }, agreementOnFile: true, verified: null });
  });

  it("never lets a supplier's name into the public id or label", () => {
    expect(parseOrigin({ ...base, id: "mock-toys", source: "supplier" }, { supplierNames: ["Mock Toys"], existing: null, now: NOW })).toMatch(/supplier's name/);
    expect(parseOrigin({ ...base, id: "supplier-a", source: "supplier", publicLabel: "Mock Toys warehouse" }, { supplierNames: ["Mock Toys"], existing: null, now: NOW })).toMatch(/supplier's name/);
  });

  it("verification needs a date, who and evidence — and can't be in the future or without rates", () => {
    const opts = { supplierNames: [], existing: null, now: NOW };
    expect(parseOrigin({ ...base, id: "supplier-a", source: "supplier", verifiedOn: "2026-10-30" }, opts)).toMatch(/evidence/);
    expect(parseOrigin({ ...base, id: "supplier-a", source: "supplier", verifiedOn: "2027-01-01", verifiedBy: "owner", evidence: "quote.pdf" }, opts)).toMatch(/future/);
    expect(parseOrigin({ ...base, ruleKind: "", id: "supplier-a", source: "supplier", verifiedOn: "2026-10-30", verifiedBy: "owner", evidence: "x" }, opts)).toMatch(/once they're entered/);
    expect(parseOrigin({ ...base, id: "supplier-a", source: "supplier", verifiedOn: "2026-10-30", verifiedBy: "owner", evidence: "private/quote.pdf" }, opts)).toMatchObject({ verified: { on: "2026-10-30", by: "owner", evidence: "private/quote.pdf" } });
  });

  it("free shipping is never assumed: a $0 rate needs written confirmation", () => {
    const opts = { supplierNames: [], existing: null, now: NOW };
    expect(parseOrigin({ ...base, firstItem: "0", id: "supplier-a", source: "supplier" }, opts)).toMatch(/\$0/);
    expect(parseOrigin({ ...base, firstItem: "0", id: "supplier-a", source: "supplier", zeroCostConfirmed: "on" }, opts)).toMatchObject({ zeroCostConfirmed: true });
  });

  it("weight tiers are typed one per line and must increase", () => {
    expect(parseTiers("250 = 4.75\n500=6.10\n1000: 8")).toEqual([{ upToGrams: 250, cents: 475 }, { upToGrams: 500, cents: 610 }, { upToGrams: 1000, cents: 800 }]);
    expect(parseTiers("heavy = lots")).toMatch(/250 = 4.75/);
    expect(parseOrigin({ ...base, ruleKind: "weight", packagingGrams: "60", tiers: "500 = 6\n250 = 4", id: "supplier-a", source: "supplier" }, { supplierNames: [], existing: null, now: NOW })).toMatch(/incomplete or inconsistent/);
  });
});

describe("draft vs live table", () => {
  it("starts as a copy of the live table and shows no changes", () => {
    const st = draftStatus(draftFrom(SHIPPING_ORIGINS), SHIPPING_ORIGINS, NOW);
    expect(st.unchanged).toBe(true);
    expect(st.origins[0].changed).toEqual([]);
  });

  it("an edit shows what changed and a new approval code; private notes never reach the public file", async () => {
    const store = new MemoryKvStore();
    const d = await loadDraft(store, SHIPPING_ORIGINS);
    const r = await saveDraft(store, d.rev, "rates", (x) => ({ ...x, origins: x.origins.map((o) => ({ ...o, rule: { kind: "per-item", firstItemCents: 500, additionalItemCents: 100, maxItemsPerPackage: 10 }, notes: "secret supplier contact", carrierService: "USPS Ground Advantage" })) }), SHIPPING_ORIGINS);
    if (!r.ok) throw new Error(r.error);
    const st = draftStatus(r.draft, SHIPPING_ORIGINS, NOW);
    expect(st.unchanged).toBe(false);
    expect(st.origins[0].changed).toEqual(["rates"]);
    expect(st.draftFingerprint).not.toBe(st.liveFingerprint);
    const json = exportJson(r.draft);
    expect(json).not.toMatch(/secret|carrierService|notes|USPS Ground/);
    expect(() => validateOrigins(JSON.parse(json))).not.toThrow();
    expect(st.origins[0].problem).toMatch(/verified/); // rates entered but not verified: still can't be checked out
  });

  it("refuses a stale save", async () => {
    const store = new MemoryKvStore();
    expect((await saveDraft(store, 0, "a", (x) => x, SHIPPING_ORIGINS)).ok).toBe(true);
    expect((await saveDraft(store, 0, "b", (x) => x, SHIPPING_ORIGINS)).ok).toBe(false);
  });

  it("prices an example cart from the draft, one package per origin", () => {
    const d = draftFrom(SHIPPING_ORIGINS);
    d.origins[0] = { ...d.origins[0], rule: { kind: "weight", packagingGrams: 50, tiers: [{ upToGrams: 300, cents: 450 }, { upToGrams: 1000, cents: 700 }] }, verified: { on: "2026-10-30", by: "test", evidence: "example" } };
    const r = previewQuote(d, [{ originId: "funksquish", grams: 120, quantity: 2 }], NOW);
    expect(r.ok && r.quote).toMatchObject({ totalCents: 450, packages: [{ packedGrams: 290 }] });
    const big = previewQuote(d, [{ originId: "funksquish", grams: 400, quantity: 3 }], NOW);
    expect(big.ok).toBe(false);
  });

  it("prices unverified draft rates for checking, and says they are unverified", () => {
    const d = draftFrom(SHIPPING_ORIGINS);
    d.origins[0] = { ...d.origins[0], rule: { kind: "per-item", firstItemCents: 400, additionalItemCents: 100, maxItemsPerPackage: 5 } };
    const r = previewQuote(d, [{ originId: "funksquish", grams: null, quantity: 3 }], NOW);
    expect(r).toMatchObject({ ok: true, unverified: ["funksquish"], quote: { totalCents: 600 } });
    expect(d.origins[0].verified).toBeNull(); // the draft itself is untouched
  });
});

describe("the public shipping file", () => {
  it("refuses fields that don't belong in a public table", () => {
    expect(() => validateOrigins([{ ...SHIPPING_ORIGINS[0], supplierName: "Mock Toys" }])).toThrow(/not an allowed field/);
    expect(() => validateOrigins([SHIPPING_ORIGINS[0], SHIPPING_ORIGINS[0]])).toThrow(/unique/);
    expect(() => validateOrigins([{ ...SHIPPING_ORIGINS[0], rule: { kind: "per-item", firstItemCents: -1, additionalItemCents: 0, maxItemsPerPackage: 1 } }])).toThrow(/rule/);
  });

  it("today's live table: our studio, with no rates yet", () => {
    expect(publicTable(draftFrom(SHIPPING_ORIGINS))).toEqual(SHIPPING_ORIGINS);
    expect(SHIPPING_ORIGINS.map((o) => [o.id, o.rule])).toEqual([["funksquish", null]]);
  });
});
