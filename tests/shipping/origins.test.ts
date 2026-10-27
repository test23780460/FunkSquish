import { describe, expect, it } from "vitest";
import { FUNKSQUISH_ORIGIN_ID, SHIPPING_ORIGINS, originIdFor, originProblem, ruleProblem, staticOriginProblem, variantShippingReady } from "@/commerce/origins";
import { TEST_SHIPPING_ORIGINS } from "@/commerce/checkout/test-fixtures";
import { localProducts } from "@/commerce/providers/local";

const NOW = new Date("2026-10-27T15:00:00Z");

describe("shipping origins", () => {
  it("our own stock defaults to the FunkSquish origin; supplier items must name theirs", () => {
    expect(originIdFor({})).toBe(FUNKSQUISH_ORIGIN_ID);
    expect(originIdFor({ fulfillmentSource: "in_house" })).toBe(FUNKSQUISH_ORIGIN_ID);
    expect(originIdFor({ fulfillmentSource: "supplier" })).toBeNull();
    expect(originIdFor({ fulfillmentSource: "supplier", fulfillmentOrigin: "supplier-a" })).toBe("supplier-a");
  });

  it("real origins carry no invented rates: every rule present has a who/when/evidence verification", () => {
    for (const o of SHIPPING_ORIGINS) {
      if (o.rule) expect(o.verified?.evidence.trim()).toBeTruthy();
      // Public file: an opaque id and a generic label, never a supplier's name or contact.
      expect(o.id).toMatch(/^[a-z][a-z0-9-]{1,30}$/);
      if (o.source === "supplier") expect(o.publicLabel).toMatch(/supplier partner/);
    }
  });

  it("until real rates are verified, real products can't be checked out", () => {
    const studio = SHIPPING_ORIGINS.find((o) => o.id === FUNKSQUISH_ORIGIN_ID)!;
    if (studio.rule === null) expect(variantShippingReady({ fulfillmentSource: "in_house" })).toBe(false);
    expect(variantShippingReady({ fulfillmentSource: "supplier" })).toBe(false);
  });

  it("every published catalog variant names a known origin of the right kind", () => {
    for (const p of localProducts.filter((x) => x.publication === "published"))
      for (const v of p.variants) {
        const id = originIdFor(v);
        expect(id, `${v.sku} has no origin`).not.toBeNull();
        const origin = SHIPPING_ORIGINS.find((o) => o.id === id);
        expect(origin, `${v.sku}: unknown origin ${id}`).toBeDefined();
        expect(origin!.source).toBe(v.fulfillmentSource ?? "in_house");
      }
  });

  it("checks rules structurally", () => {
    const base = TEST_SHIPPING_ORIGINS[0];
    expect(ruleProblem(base)).toBeNull();
    expect(ruleProblem({ rule: null })).toBe("no-rates");
    expect(ruleProblem({ rule: { kind: "weight", packagingGrams: 60, tiers: [] } })).toBe("invalid-rule");
    expect(ruleProblem({ rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 500, cents: 650 }, { upToGrams: 250, cents: 450 }] } })).toBe("invalid-rule");
    expect(ruleProblem({ rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 250, cents: -1 }] } })).toBe("invalid-rule");
    expect(ruleProblem({ rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 250, cents: 4.5 }] } })).toBe("invalid-rule");
    expect(ruleProblem({ rule: { kind: "per-item", firstItemCents: 599, additionalItemCents: 150, maxItemsPerPackage: 0 } })).toBe("invalid-rule");
    expect(ruleProblem({ rule: { kind: "per-item", firstItemCents: 0, additionalItemCents: 0, maxItemsPerPackage: 3 } })).toBe("zero-cost-unconfirmed");
  });

  it("needs a complete verification record, a processing time and (suppliers) an agreement", () => {
    const sup = TEST_SHIPPING_ORIGINS[1];
    expect(staticOriginProblem(sup)).toBeNull();
    expect(staticOriginProblem({ ...sup, verified: null })).toBe("not-verified");
    expect(staticOriginProblem({ ...sup, verified: { on: "2026-10-27", by: "owner", evidence: " " } })).toBe("not-verified");
    expect(staticOriginProblem({ ...sup, processingBusinessDays: 0 })).toBe("no-processing-time");
    expect(staticOriginProblem({ ...sup, agreementOnFile: false })).toBe("no-supplier-agreement");
    expect(staticOriginProblem({ ...sup, id: "in_house-1" })).toBe("unknown-origin");
    expect(staticOriginProblem(sup, "in_house")).toBe("source-mismatch");
    expect(staticOriginProblem(undefined)).toBe("unknown-origin");
  });

  it("expires verifications after reviewEveryDays", () => {
    const sup = { ...TEST_SHIPPING_ORIGINS[1], reviewEveryDays: 30, verified: { on: "2026-09-01", by: "owner", evidence: "card" } };
    expect(originProblem(sup, new Date("2026-09-30T00:00:00Z"))).toBeNull();
    expect(originProblem(sup, NOW)).toBe("verification-expired");
  });
});
