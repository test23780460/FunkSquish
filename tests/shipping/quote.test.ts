import { describe, expect, it } from "vitest";
import {
  MAX_PACKAGES_PER_ORDER,
  decodeShippingPlan,
  encodeShippingPlan,
  packageNote,
  quoteShipping,
  shippingDisplayName,
  type QuoteLine,
} from "@/commerce/checkout/shipping-quote";
import { TEST_SHIPPING_ORIGINS } from "@/commerce/checkout/test-fixtures";
import type { ShippingOrigin } from "@/commerce/origins";

const NOW = new Date("2026-10-27T15:00:00Z");
const O = TEST_SHIPPING_ORIGINS;

const jelly = (quantity = 1, over: Partial<QuoteLine> = {}): QuoteLine => ({
  variantId: "test-var-jelly-blue",
  name: "Jelly",
  quantity,
  fulfillmentSource: "in_house",
  fulfillmentOrigin: "test-studio",
  weightGrams: 120,
  statedProcessingDays: null,
  ...over,
});
const mint = (quantity = 1): QuoteLine => ({ variantId: "test-var-supplier-mint", name: "Mint", quantity, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-a", weightGrams: 120, statedProcessingDays: null });
const peach = (quantity = 1): QuoteLine => ({ variantId: "test-var-supplierb-peach", name: "Peach", quantity, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-b", weightGrams: 150, statedProcessingDays: null });
const lime = (): QuoteLine => ({ variantId: "test-var-unrated-lime", name: "Lime", quantity: 1, fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-unrated", weightGrams: 120, statedProcessingDays: null });

function ok(lines: QuoteLine[], registry: ShippingOrigin[] = O, now = NOW) {
  const r = quoteShipping(lines, registry, now);
  if (!r.ok) throw new Error(`expected a quote, got: ${r.blocked.map((b) => b.ownerDetail).join("; ")}`);
  return r.quote;
}

describe("single origin (our own stock, weight-based)", () => {
  it("prices one package by packed weight (items + packaging)", () => {
    expect(ok([jelly(1)])).toMatchObject({ totalCents: 450, packages: [{ groupId: "test-studio", units: 1, packedGrams: 180, cents: 450, processingBusinessDays: 2 }] });
    expect(ok([jelly(3)]).totalCents).toBe(650); // 60 + 360 = 420 g
    expect(ok([jelly(7)]).totalCents).toBe(900); // 900 g
  });

  it("puts every item from the same origin in ONE package — one base charge, not one per item", () => {
    const q = ok([jelly(2), jelly(1, { variantId: "test-var-jelly-pink", name: "Pink" })]);
    expect(q.packages).toHaveLength(1);
    expect(q.packages[0].variantIds).toEqual(["test-var-jelly-blue", "test-var-jelly-pink"]);
    expect(q.totalCents).toBe(650); // 60 + 3 × 120 = 420 g → one 650 charge (not 3 × 450)
  });

  it("refuses a package bigger than the largest verified tier instead of guessing a price", () => {
    const r = quoteShipping([jelly(8)], O, NOW); // 1020 g > 1000 g
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.blocked[0]).toMatchObject({ reason: "too-large", variantId: "test-var-jelly-blue" });
      expect(r.message).toMatch(/won't fit in one package/);
    }
  });

  it("refuses an item with no shipping weight when its origin prices by weight", () => {
    const r = quoteShipping([jelly(1, { weightGrams: null })], O, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.blocked[0].ownerDetail).toMatch(/weight is missing/);
  });
});

describe("supplier-only carts", () => {
  it("per-item supplier rate: first item + each additional, in one package", () => {
    expect(ok([mint(1)]).totalCents).toBe(599);
    expect(ok([mint(3)]).totalCents).toBe(599 + 2 * 150);
  });

  it("two suppliers = two packages, each priced from its own verified rule", () => {
    const q = ok([mint(1), peach(2)]);
    expect(q.packages.map((p) => [p.groupId, p.cents, p.processingBusinessDays])).toEqual([
      ["test-supplier-a", 599, 3],
      ["test-supplier-b", 700, 5], // 80 + 300 = 380 g
    ]);
    expect(q.totalCents).toBe(1299);
  });
});

describe("mixed carts (our stock + suppliers)", () => {
  it("adds up one charge per package, each with its own processing time", () => {
    const q = ok([jelly(2), mint(1), peach(1)]);
    expect(q.packages.map((p) => p.groupId)).toEqual(["test-studio", "test-supplier-a", "test-supplier-b"]);
    expect(q.packages.map((p) => p.cents)).toEqual([650, 599, 700]);
    expect(q.totalCents).toBe(1949);
    expect(shippingDisplayName(q)).toBe("Shipping (3 packages)");
  });

  it("can cost more than a single-origin cart — and says so before payment", () => {
    expect(ok([jelly(1), mint(1)]).totalCents).toBeGreaterThan(ok([jelly(2)]).totalCents);
    const note = packageNote(ok([jelly(1), mint(1)]));
    expect(note).toMatch(/2 separate packages, each with its own tracking email/);
    expect(note).toMatch(/covers all of them/);
  });

  it("discloses before payment when a package's origin can't ship to military addresses", () => {
    expect(packageNote(ok([jelly(1), mint(1)]))).toMatch(/test supplier partner A can't be sent to APO\/FPO\/DPO/);
    expect(packageNote(ok([jelly(1), peach(1)]))).not.toMatch(/APO/);
  });
});

describe("never guesses: missing rates or commitments block only the affected items", () => {
  it("refuses an item whose supplier has no verified rates, with a plain explanation", () => {
    const r = quoteShipping([jelly(1), lime()], O, NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.blocked).toHaveLength(1);
    expect(r.blocked[0]).toMatchObject({ variantId: "test-var-unrated-lime", reason: "shipping-unavailable" });
    expect(r.blocked[0].message).toBe("Shipping for Lime isn't set up yet, so it can't be ordered right now. Please remove it to continue — the rest of your cart can still be ordered.");
    expect(r.blocked[0].ownerDetail).toMatch(/No verified shipping rates/);
    // The rest of the cart still has a real price.
    expect(r.partial.packages.map((p) => p.groupId)).toEqual(["test-studio"]);
  });

  it("never treats a supplier without rates as free shipping", () => {
    const r = quoteShipping([lime()], O, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial.totalCents).toBe(0);
  });

  it("refuses a supplier item with no origin, an unknown origin, or a mismatched source", () => {
    for (const l of [
      { ...mint(), fulfillmentOrigin: null },
      { ...mint(), fulfillmentOrigin: "nobody" },
      { ...mint(), fulfillmentOrigin: "test-studio" }, // supplier item claiming our studio
    ]) {
      const r = quoteShipping([l], O, NOW);
      expect(r.ok).toBe(false);
    }
  });

  it("stops quoting when the rate verification is too old (or dated in the future)", () => {
    const stale: ShippingOrigin = { ...O[1], reviewEveryDays: 90, verified: { on: "2026-06-01", by: "owner", evidence: "rate card" } };
    const reg = [O[0], stale];
    expect(quoteShipping([mint()], reg, NOW).ok).toBe(false);
    expect(quoteShipping([mint()], reg, new Date("2026-08-01T00:00:00Z")).ok).toBe(true);
    const future: ShippingOrigin = { ...O[1], verified: { on: "2027-01-01", by: "owner", evidence: "rate card" } };
    expect(quoteShipping([mint()], [future], NOW).ok).toBe(false);
  });

  it("refuses a supplier without a signed agreement or without a committed processing time", () => {
    expect(quoteShipping([mint()], [{ ...O[1], agreementOnFile: false }], NOW).ok).toBe(false);
    expect(quoteShipping([mint()], [{ ...O[1], processingBusinessDays: null }], NOW).ok).toBe(false);
  });

  it("accepts a $0 rate only when free shipping was explicitly confirmed", () => {
    const free: ShippingOrigin = { ...O[1], rule: { kind: "per-item", firstItemCents: 0, additionalItemCents: 0, maxItemsPerPackage: 6 } };
    expect(quoteShipping([mint()], [free], NOW).ok).toBe(false);
    const q = ok([mint()], [{ ...free, zeroCostConfirmed: true }]);
    expect(q.totalCents).toBe(0);
    expect(shippingDisplayName(q)).toBe("Free shipping");
  });

  it("refuses a product page that promises faster shipping than its origin commits to", () => {
    const r = quoteShipping([{ ...mint(), statedProcessingDays: 2 }], O, NOW); // supplier A commits to 3
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.blocked[0].ownerDetail).toMatch(/promises 2 business days but this origin commits to 3/);
  });

  it("uses the strictest promise in a package for its ship-by date", () => {
    const q = ok([jelly(1, { statedProcessingDays: 4 }), jelly(1, { variantId: "test-var-jelly-pink", name: "Pink" })]);
    expect(q.packages[0].processingBusinessDays).toBe(2);
    expect(ok([jelly(1, { statedProcessingDays: 4 })]).packages[0].processingBusinessDays).toBe(4);
  });

  it(`limits a cart to ${MAX_PACKAGES_PER_ORDER} packages`, () => {
    const many: ShippingOrigin[] = Array.from({ length: 6 }, (_, i) => ({ ...O[1], id: `sup-${i}` }));
    const lines = many.map((o, i) => ({ ...mint(), variantId: `v${i}`, name: `Item ${i}`, fulfillmentOrigin: o.id }));
    const r = quoteShipping(lines, many, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.blocked).toHaveLength(1);
      expect(r.blocked[0]).toMatchObject({ variantId: "v5", reason: "too-many-origins" });
    }
  });
});

describe("the package plan stored on the Stripe session", () => {
  it("round-trips", () => {
    const q = ok([jelly(2), mint(1), peach(1)]);
    const enc = encodeShippingPlan(q);
    expect(enc).toBe("v1;test-studio:h:650:2:1;test-supplier-a:s:599:3:0;test-supplier-b:s:700:5:1");
    expect(decodeShippingPlan(enc)).toEqual([
      { groupId: "test-studio", source: "in_house", cents: 650, processingBusinessDays: 2, militaryAddresses: true },
      { groupId: "test-supplier-a", source: "supplier", cents: 599, processingBusinessDays: 3, militaryAddresses: false },
      { groupId: "test-supplier-b", source: "supplier", cents: 700, processingBusinessDays: 5, militaryAddresses: true },
    ]);
  });

  it("rejects anything malformed or tampered", () => {
    for (const bad of [undefined, "", "v2;a:h:1:2:1", "v1", "v1;A:h:1:2:1", "v1;ok-id:x:1:2:1", "v1;ok-id:h:-1:2:1", "v1;ok-id:h:1:0:1", "v1;ok-id:h:1:31:1", "v1;ok-id:h:1:2:1;ok-id:h:1:2:1", "v1;" + Array(6).fill("ab:h:1:2:1").join(";"), 42]) {
      expect(decodeShippingPlan(bad)).toBeNull();
    }
  });
});

describe("reading the packages back from Stripe", async () => {
  const { snapshotFromStripeSession } = await import("@/commerce/orders/session-snapshot");
  it("reads the plan, each line's origin and tax, and the tax on shipping", () => {
    const snap = snapshotFromStripeSession({
      id: "cs_test_x",
      livemode: false,
      status: "complete",
      payment_status: "paid",
      metadata: { shipping_plan: "v1;test-studio:h:650:2:1;test-supplier-a:s:599:3:0" },
      shipping_cost: { amount_total: 1249, amount_tax: 75, shipping_rate: null },
      total_details: { amount_shipping: 1249, amount_tax: 150, amount_discount: 0 },
      line_items: {
        data: [
          { description: "Blue", quantity: 1, amount_total: 530, amount_tax: 30, price: { unit_amount: 500, product: { metadata: { variant_id: "v1", fulfillment_source: "in_house", fulfillment_origin: "test-studio" } } } },
          { description: "Mint", quantity: 1, amount_total: 795, amount_tax: 45, price: { unit_amount: 750, product: { metadata: { variant_id: "v2", fulfillment_source: "supplier", fulfillment_origin: "BAD ORIGIN" } } } },
        ],
      },
    } as never);
    expect(snap.shippingPlan?.map((p) => p.groupId)).toEqual(["test-studio", "test-supplier-a"]);
    expect(snap.amounts).toMatchObject({ shipping: 1249, shippingTax: 75 });
    expect(snap.lineItems.map((l) => [l.fulfillmentOrigin, l.amountTax])).toEqual([["test-studio", 30], [null, 45]]);
  });
});
