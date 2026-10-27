import { describe, expect, it } from "vitest";
import { normalizeCartLines, validateCartAgainstCatalog } from "@/commerce/checkout/validate-cart";
import { TEST_FIXTURE_PRODUCTS, isTestFixtureVariant } from "@/commerce/checkout/test-fixtures";
import { previewProducts } from "@/commerce/providers/preview";
import type { Product } from "@/commerce/types";

const testOnly = (_p: Product, v: { id: string }) => isTestFixtureVariant(v.id);
const catalog = [...TEST_FIXTURE_PRODUCTS, ...previewProducts];

function check(raw: unknown) {
  const n = normalizeCartLines(raw);
  if (!n.ok) return n;
  return validateCartAgainstCatalog(n.value, catalog, testOnly);
}

describe("normalizeCartLines", () => {
  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fraction", 1.5],
    ["too many", 11],
    ["string", "2"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["missing", undefined],
  ])("rejects %s quantities", (_label, quantity) => {
    const r = normalizeCartLines([{ variantId: "test-var-jelly-blue", quantity }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("bad-quantity");
  });

  it("rejects empty, non-array and oversized carts", () => {
    expect(normalizeCartLines([])).toMatchObject({ ok: false, code: "empty" });
    expect(normalizeCartLines("nope")).toMatchObject({ ok: false, code: "empty" });
    expect(normalizeCartLines(null)).toMatchObject({ ok: false, code: "empty" });
    const big = Array.from({ length: 21 }, (_, i) => ({ variantId: `v${i}`, quantity: 1 }));
    expect(normalizeCartLines(big)).toMatchObject({ ok: false, code: "too-many-lines" });
  });

  it("rejects malformed lines and suspicious ids", () => {
    expect(normalizeCartLines([null])).toMatchObject({ ok: false, code: "bad-line" });
    expect(normalizeCartLines([{ quantity: 1 }])).toMatchObject({ ok: false, code: "bad-line" });
    expect(normalizeCartLines([{ variantId: "<script>", quantity: 1 }])).toMatchObject({ ok: false, code: "bad-line" });
    expect(normalizeCartLines([{ variantId: "x".repeat(201), quantity: 1 }])).toMatchObject({ ok: false, code: "bad-line" });
  });

  it("merges duplicate entries for the same item", () => {
    const r = normalizeCartLines([
      { variantId: "test-var-jelly-blue", quantity: 2 },
      { variantId: "test-var-jelly-blue", quantity: 3 },
    ]);
    expect(r).toEqual({ ok: true, value: [{ variantId: "test-var-jelly-blue", quantity: 5 }] });
  });

  it("rejects duplicates that add up past the per-item limit", () => {
    const r = normalizeCartLines([
      { variantId: "test-var-jelly-blue", quantity: 6 },
      { variantId: "test-var-jelly-blue", quantity: 6 },
    ]);
    expect(r).toMatchObject({ ok: false, code: "too-many-of-one" });
  });
});

describe("validateCartAgainstCatalog", () => {
  it("prices every line from the server catalog", () => {
    const r = check([{ variantId: "test-var-jelly-blue", quantity: 2 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual([
        expect.objectContaining({ variantId: "test-var-jelly-blue", sku: "TEST-JELLY-BLUE", quantity: 2, unitAmount: 500, currency: "usd", fulfillmentSource: "in_house" }),
      ]);
    }
  });

  it("ignores prices sent by the browser", () => {
    const r = check([{ variantId: "test-var-jelly-blue", quantity: 1, price: 1, unitAmount: 1 }]);
    expect(r.ok && r.value[0].unitAmount).toBe(500);
  });

  it("carries the fulfillment source for supplier-shipped items", () => {
    const r = check([{ variantId: "test-var-supplier-mint", quantity: 1 }]);
    expect(r.ok && r.value[0].fulfillmentSource).toBe("supplier");
  });

  it("refuses preview samples (not for sale)", () => {
    expect(check([{ variantId: "pv-berry-slushie-strawberry", quantity: 1 }])).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("refuses unknown products", () => {
    expect(check([{ variantId: "test-var-nope", quantity: 1 }])).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("refuses sold-out items", () => {
    expect(check([{ variantId: "test-var-jelly-gone", quantity: 1 }])).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("refuses more than the stock on hand", () => {
    const r = check([{ variantId: "test-var-jelly-pink", quantity: 2 }]);
    expect(r).toMatchObject({ ok: false, code: "not-enough-stock" });
    if (!r.ok) expect(r.message).toContain("Only 1");
  });

  it("refuses items whose price is missing, too low, or not USD", () => {
    const base = TEST_FIXTURE_PRODUCTS[0];
    const variant = { ...base.variants[0], id: "test-var-x" };
    const mk = (price: unknown) => [{ ...base, variants: [{ ...variant, price } as never] }];
    for (const price of [null, { amount: 49, currency: "USD" }, { amount: 5.5, currency: "USD" }, { amount: 500, currency: "EUR" }]) {
      expect(validateCartAgainstCatalog([{ variantId: "test-var-x", quantity: 1 }], mk(price), testOnly)).toMatchObject({ ok: false, code: "unavailable" });
    }
  });

  it("refuses untracked stock and unpublished products", () => {
    const base = TEST_FIXTURE_PRODUCTS[0];
    const untracked = [{ ...base, variants: [{ ...base.variants[0], inventory: { tracked: false, available: null } }] }];
    expect(validateCartAgainstCatalog([{ variantId: "test-var-jelly-blue", quantity: 1 }], untracked, testOnly)).toMatchObject({ ok: false });
    const draft = [{ ...base, publication: "draft" as const }];
    expect(validateCartAgainstCatalog([{ variantId: "test-var-jelly-blue", quantity: 1 }], draft, testOnly)).toMatchObject({ ok: false });
  });
});
