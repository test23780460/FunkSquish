import type { ShippingOrigin } from "@/commerce/origins";
import { newRecord, emptyPrivateVariant, type ProductRecord } from "@/commerce/catalog-admin/record";
import type { ReadinessContext } from "@/commerce/catalog-admin/readiness";
import { paletteFrom } from "@/commerce/catalog-admin/palette";

/** A made-up, verified shipping origin for tests only (never the real table). */
export const TEST_VERIFIED_ORIGIN: ShippingOrigin = {
  id: "funksquish",
  source: "in_house",
  publicLabel: "FunkSquish",
  rule: { kind: "per-item", firstItemCents: 500, additionalItemCents: 100, maxItemsPerPackage: 10 },
  verified: { on: "2026-10-30", by: "test", evidence: "test-fixture" },
  reviewEveryDays: 90,
  processingBusinessDays: 2,
  agreementOnFile: true,
  militaryAddresses: true,
};

export const ctx = (over: Partial<ReadinessContext> = {}): ReadinessContext => ({ origins: [TEST_VERIFIED_ORIGIN], otherSkus: new Map(), supplierIds: new Set(), ...over });

/** A fictional product with every launch-readiness item filled in. */
export function completeRecord(name = "Fictional Test Squishy", slug = "fictional-test-squishy", sku = "TEST-FICT-1"): ProductRecord {
  const r = newRecord({ name, slug, category: "jelly-squishies" }, new Date("2026-10-31T12:00:00Z"));
  const vid = `${r.id}-v1`;
  r.product.shortDescription = "A made-up squishy used only in tests.";
  r.product.description = "This fictional product exists only in automated tests and is never published anywhere.";
  r.product.media = [{ type: "image", src: "/media/0123456789abcdef0123456789abcdef.jpg", alt: "Test photo of a fictional squishy", width: 1200, height: 1200 }];
  r.product.variants = [
    {
      id: vid,
      sku,
      name: "Default",
      swatch: "#ff7ab8",
      palette: paletteFrom("#ff7ab8"),
      price: { amount: 1299, currency: "USD" },
      compareAtPrice: null,
      inventory: { tracked: true, available: 10 },
      weightGrams: 120,
      dimensions: { lengthCm: 10, widthCm: 8, heightCm: 6 },
      externalPurchaseUrl: null,
      fulfillmentSource: "in_house",
    },
  ];
  r.product.safety = { ageGrade: "Ages 3+", warnings: ["Test warning text"], careInstructions: [], manufacturerOrImporter: "Fictional Maker Ltd", countryOfOrigin: "Testland" };
  r.private.variants[vid] = { ...emptyPrivateVariant(), costCents: 300, costVerified: true, priceVerified: true };
  r.private.compliance = { status: "verified", cpcFile: "test-cpc.pdf", testReportFile: "test-report.pdf", testLab: "Test Lab", testDate: "2026-10-01", trackingLabelPhoto: "test-label.jpg" };
  r.private.photosAuthentic = true;
  r.private.warningsReviewed = true;
  r.private.shippingMeasured = true;
  return r;
}
