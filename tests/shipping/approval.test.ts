import { describe, expect, it } from "vitest";
import { SHIPPING_ORIGINS, originProblem, type ShippingOrigin } from "@/commerce/origins";
import { TEST_SHIPPING_ORIGINS } from "@/commerce/checkout/test-fixtures";
import { liveShippingProblem, shippingApprovalStatus, shippingTableFingerprint } from "@/commerce/shipping-approval";

const NOW = new Date("2026-11-03T15:00:00Z");
const studio: ShippingOrigin = {
  ...SHIPPING_ORIGINS[0],
  rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 500, cents: 650 }] },
  verified: { on: "2026-11-01", by: "owner", evidence: "private/shipping/usps-2026-11.pdf" },
};
const fp = (o: ShippingOrigin[]) => shippingTableFingerprint(o);

describe("shipping table fingerprint (owner approval for live checkout)", () => {
  it("is stable and readable", () => {
    expect(fp([studio])).toMatch(/^ship_v1_[0-9a-f]{16}$/);
    expect(fp([studio])).toBe(fp([{ ...studio }]));
    // Order of origins or of keys doesn't matter.
    const other = { ...studio, id: "supplier-a", source: "supplier" as const };
    expect(fp([studio, other])).toBe(fp([other, studio]));
    expect(fp([studio])).toBe(fp([Object.fromEntries(Object.entries(studio).reverse()) as unknown as ShippingOrigin]));
  });

  it("changes whenever what customers are charged or promised changes", () => {
    const base = fp([studio]);
    const changes: Partial<ShippingOrigin>[] = [
      { rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 500, cents: 651 }] } },
      { rule: { kind: "per-item", firstItemCents: 650, additionalItemCents: 100, maxItemsPerPackage: 5 } },
      { verified: { on: "2026-11-02", by: "owner", evidence: "private/shipping/usps-2026-11.pdf" } },
      { processingBusinessDays: 3 },
      { militaryAddresses: false },
      { reviewEveryDays: 120 },
      { zeroCostConfirmed: true },
    ];
    for (const c of changes) expect(fp([{ ...studio, ...c }]), JSON.stringify(c)).not.toBe(base);
    expect(fp([studio, { ...studio, id: "supplier-a", source: "supplier" }])).not.toBe(base); // a new origin
  });

  it("ignores display-only wording", () => {
    expect(fp([{ ...studio, publicLabel: "FunkSquish HQ" }])).toBe(fp([studio]));
  });
});

describe("live shipping lock", () => {
  it("today's real table has no verified rates, so live checkout stays shut", () => {
    expect(liveShippingProblem(SHIPPING_ORIGINS, fp(SHIPPING_ORIGINS))).toBe("shipping-not-verified");
  });

  it("needs verified, current rates AND the owner's approval of that exact table", () => {
    expect(liveShippingProblem([studio], fp([studio]))).toBeNull();
    expect(liveShippingProblem([studio], undefined)).toBe("shipping-not-approved");
    expect(liveShippingProblem([studio], ` ${fp([studio])} `)).toBeNull(); // pasted with spaces
    // Rates edited after approval → shut until re-approved.
    const edited = [{ ...studio, rule: { kind: "weight" as const, packagingGrams: 60, tiers: [{ upToGrams: 500, cents: 450 }] } }];
    expect(liveShippingProblem(edited, fp([studio]))).toBe("shipping-not-approved");
  });

  it("a verification past its review date (or dated in the future) is refused item by item at checkout, and the owner page shows it", () => {
    // The lock itself reads no clock (pages using it are built ahead of time) …
    const old = { ...studio, verified: { ...studio.verified!, on: "2026-07-01" } };
    expect(liveShippingProblem([old], fp([old]))).toBeNull();
    // … but checkout refuses every item from that origin, every time,
    expect(originProblem(old, NOW, old.source)).toBe("verification-expired");
    const future = { ...studio, verified: { ...studio.verified!, on: "2026-12-25" } };
    expect(originProblem(future, NOW, future.source)).toBe("not-verified");
    // … and the owner page counts it as not verified.
    expect(shippingApprovalStatus([old], { STRIPE_LIVE_SHIPPING_TABLE: fp([old]) }, NOW).verifiedOrigins).toBe(0);
  });

  it("an origin with no rule or no recorded verification never opens the lock", () => {
    expect(liveShippingProblem([{ ...studio, verified: null }], fp([{ ...studio, verified: null }]))).toBe("shipping-not-verified");
    expect(liveShippingProblem([{ ...studio, rule: null }], fp([{ ...studio, rule: null }]))).toBe("shipping-not-verified");
  });

  it("a supplier counts only with a signed agreement", () => {
    const supplier: ShippingOrigin = { ...studio, id: "supplier-a", source: "supplier", agreementOnFile: false };
    expect(liveShippingProblem([supplier], fp([supplier]))).toBe("shipping-not-verified");
    const signed = { ...supplier, agreementOnFile: true };
    expect(liveShippingProblem([signed], fp([signed]))).toBeNull();
  });

  it("test fixtures are never what the live lock reads", () => {
    expect(fp(TEST_SHIPPING_ORIGINS)).not.toBe(fp(SHIPPING_ORIGINS));
  });
});

describe("owner page status", () => {
  it("shows the approval code and whether Production matches", () => {
    expect(shippingApprovalStatus([studio], {}, NOW)).toEqual({ fingerprint: fp([studio]), verifiedOrigins: 1, approval: "not-set", problem: "shipping-not-approved" });
    expect(shippingApprovalStatus([studio], { STRIPE_LIVE_SHIPPING_TABLE: fp([studio]) }, NOW)).toMatchObject({ approval: "matches", problem: null });
    expect(shippingApprovalStatus([studio], { STRIPE_LIVE_SHIPPING_TABLE: "ship_v1_old" }, NOW)).toMatchObject({ approval: "different", problem: "shipping-not-approved" });
    expect(shippingApprovalStatus(SHIPPING_ORIGINS, {}, NOW)).toMatchObject({ verifiedOrigins: 0, problem: "shipping-not-verified" });
  });
});
