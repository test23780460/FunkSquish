import type { Product, ProductVariant } from "../types";
import type { ShippingOrigin } from "../origins";

/**
 * STRIPE TEST-MODE FIXTURES — NOT REAL PRODUCTS.
 *
 * Only reachable when `testCheckoutEnabled()` is true, which is impossible on
 * the production site (see ./environment.ts). They never enter the public
 * catalog, sitemap or shop pages. Prices and stock are made-up test values
 * chosen to exercise checkout rules (normal stock, last unit, sold out,
 * supplier-shipped) — they are NOT FunkSquish prices.
 */

const palette = { base: "#9fd3ff", light: "#e4f3ff", shade: "#1f5fd6", accent: "#ff6fa8" };
const noSafety = { ageGrade: null, warnings: [], careInstructions: [], manufacturerOrImporter: null, countryOfOrigin: null };
const noSpecs = { material: null, fill: null, texture: null, sizeDescription: null };

function variant(id: string, sku: string, name: string, cents: number, available: number, extra: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id,
    sku,
    name,
    swatch: palette.base,
    palette,
    price: { amount: cents, currency: "USD" },
    compareAtPrice: null,
    inventory: { tracked: true, available },
    weightGrams: 120,
    dimensions: null,
    externalPurchaseUrl: null,
    fulfillmentSource: "in_house",
    ...extra,
  };
}

function product(id: string, name: string, variants: ProductVariant[]): Product {
  return {
    id,
    slug: id,
    name,
    category: "jelly-squishies",
    publication: "published",
    shortDescription: "Stripe test-mode fixture. Not a real product.",
    description: "Stripe test-mode fixture used to exercise checkout. Not for sale.",
    media: [],
    art: "jelly",
    variants,
    specs: noSpecs,
    safety: noSafety,
    tags: ["test-fixture"],
    featuredRank: 999,
    createdAt: "2026-10-24",
  };
}

const testVerified = { on: "2026-10-27", by: "test fixture", evidence: "made-up test values — not a real rate" };

/**
 * TEST shipping origins with made-up rates (NOT real FunkSquish or supplier
 * rates). They exist only so test mode can exercise single-origin, supplier-only
 * and mixed carts, a weight-based and a per-item rule, a supplier that can't ship
 * to military addresses, and a supplier whose rates aren't verified (blocked).
 */
export const TEST_SHIPPING_ORIGINS: ShippingOrigin[] = [
  {
    id: "test-studio",
    source: "in_house",
    publicLabel: "FunkSquish (test)",
    rule: { kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 250, cents: 450 }, { upToGrams: 500, cents: 650 }, { upToGrams: 1000, cents: 900 }] },
    verified: testVerified,
    reviewEveryDays: 36_500,
    processingBusinessDays: 2,
    agreementOnFile: true,
    militaryAddresses: true,
  },
  {
    id: "test-supplier-a",
    source: "supplier",
    publicLabel: "test supplier partner A",
    rule: { kind: "per-item", firstItemCents: 599, additionalItemCents: 150, maxItemsPerPackage: 6 },
    verified: testVerified,
    reviewEveryDays: 36_500,
    processingBusinessDays: 3,
    agreementOnFile: true,
    militaryAddresses: false,
  },
  {
    id: "test-supplier-b",
    source: "supplier",
    publicLabel: "test supplier partner B",
    rule: { kind: "weight", packagingGrams: 80, tiers: [{ upToGrams: 400, cents: 700 }, { upToGrams: 600, cents: 1100 }] },
    verified: testVerified,
    reviewEveryDays: 36_500,
    processingBusinessDays: 5,
    agreementOnFile: true,
    militaryAddresses: true,
  },
  {
    id: "test-supplier-unrated",
    source: "supplier",
    publicLabel: "test supplier partner C",
    rule: null, // no verified rates → its items must be refused at checkout
    verified: null,
    reviewEveryDays: 90,
    processingBusinessDays: 4,
    agreementOnFile: true,
    militaryAddresses: true,
  },
];

const studio = { fulfillmentOrigin: "test-studio" } as const;

export const TEST_FIXTURE_PRODUCTS: Product[] = [
  product("test-fixture-jelly", "TEST Jelly Squish (test mode)", [
    variant("test-var-jelly-blue", "TEST-JELLY-BLUE", "Blue", 500, 5, studio),
    variant("test-var-jelly-pink", "TEST-JELLY-PINK", "Pink — last one", 500, 1, studio),
    variant("test-var-jelly-gone", "TEST-JELLY-GONE", "Grey — sold out", 500, 0, studio),
  ]),
  product("test-fixture-supplier", "TEST Supplier-Shipped Squish (test mode)", [
    variant("test-var-supplier-mint", "TEST-SUPPLIER-MINT", "Mint", 750, 3, { fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-a" }),
  ]),
  product("test-fixture-supplier-b", "TEST Second-Supplier Squish (test mode)", [
    variant("test-var-supplierb-peach", "TEST-SUPPLIERB-PEACH", "Peach", 650, 4, { fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-b", weightGrams: 150 }),
  ]),
  product("test-fixture-unrated", "TEST Unrated-Supplier Squish (test mode)", [
    variant("test-var-unrated-lime", "TEST-UNRATED-LIME", "Lime — shipping not set up", 600, 5, { fulfillmentSource: "supplier", fulfillmentOrigin: "test-supplier-unrated" }),
  ]),
];

export function isTestFixtureVariant(variantId: string): boolean {
  return variantId.startsWith("test-var-");
}

/** Deliberately bad carts the server must reject (shown on the test harness). */
export const TEST_BAD_CARTS: { label: string; lines: unknown; acceptedAtCatalogPrice?: boolean }[] = [
  { label: "Quantity 0", lines: [{ variantId: "test-var-jelly-blue", quantity: 0 }] },
  { label: "Quantity 11", lines: [{ variantId: "test-var-jelly-blue", quantity: 11 }] },
  { label: "Quantity 1.5", lines: [{ variantId: "test-var-jelly-blue", quantity: 1.5 }] },
  { label: "Quantity \"2\" (text)", lines: [{ variantId: "test-var-jelly-blue", quantity: "2" }] },
  { label: "Duplicate lines over the limit (6 + 6)", lines: [{ variantId: "test-var-jelly-blue", quantity: 6 }, { variantId: "test-var-jelly-blue", quantity: 6 }] },
  { label: "More than in stock (2 of the last one)", lines: [{ variantId: "test-var-jelly-pink", quantity: 2 }] },
  { label: "Sold-out item", lines: [{ variantId: "test-var-jelly-gone", quantity: 1 }] },
  { label: "Unknown product", lines: [{ variantId: "test-var-does-not-exist", quantity: 1 }] },
  { label: "Preview sample (not for sale)", lines: [{ variantId: "pv-berry-slushie-strawberry", quantity: 1 }] },
  { label: "Item whose shipping isn't set up (unverified supplier rates)", lines: [{ variantId: "test-var-unrated-lime", quantity: 1 }] },
  { label: "Too big for one supplier package (4 × Peach = 680 g, supplier B's largest box is 600 g)", lines: [{ variantId: "test-var-jelly-blue", quantity: 1 }, { variantId: "test-var-supplierb-peach", quantity: 4 }] },
  // Not rejected: the browser's price fields are ignored and the server's price is used (verified in Stripe: $5.00).
  { label: "Tampered price ($0.01 sent by browser)", lines: [{ variantId: "test-var-jelly-blue", quantity: 1, price: 1, unitAmount: 1 }], acceptedAtCatalogPrice: true },
  { label: "Empty cart", lines: [] },
];
