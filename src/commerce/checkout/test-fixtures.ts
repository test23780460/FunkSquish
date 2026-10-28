import type { Product, ProductVariant } from "../types";

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

export const TEST_FIXTURE_PRODUCTS: Product[] = [
  product("test-fixture-jelly", "TEST Jelly Squish (test mode)", [
    variant("test-var-jelly-blue", "TEST-JELLY-BLUE", "Blue", 500, 5),
    variant("test-var-jelly-pink", "TEST-JELLY-PINK", "Pink — last one", 500, 1),
    variant("test-var-jelly-gone", "TEST-JELLY-GONE", "Grey — sold out", 500, 0),
  ]),
  product("test-fixture-supplier", "TEST Supplier-Shipped Squish (test mode)", [
    variant("test-var-supplier-mint", "TEST-SUPPLIER-MINT", "Mint", 750, 3, { fulfillmentSource: "supplier" }),
  ]),
];

export function isTestFixtureVariant(variantId: string): boolean {
  return variantId.startsWith("test-var-");
}

/** Deliberately bad carts the server must reject (shown on the test harness). */
export const TEST_BAD_CARTS: { label: string; lines: unknown }[] = [
  { label: "Quantity 0", lines: [{ variantId: "test-var-jelly-blue", quantity: 0 }] },
  { label: "Quantity 11", lines: [{ variantId: "test-var-jelly-blue", quantity: 11 }] },
  { label: "Quantity 1.5", lines: [{ variantId: "test-var-jelly-blue", quantity: 1.5 }] },
  { label: "Quantity \"2\" (text)", lines: [{ variantId: "test-var-jelly-blue", quantity: "2" }] },
  { label: "Duplicate lines over the limit (6 + 6)", lines: [{ variantId: "test-var-jelly-blue", quantity: 6 }, { variantId: "test-var-jelly-blue", quantity: 6 }] },
  { label: "More than in stock (2 of the last one)", lines: [{ variantId: "test-var-jelly-pink", quantity: 2 }] },
  { label: "Sold-out item", lines: [{ variantId: "test-var-jelly-gone", quantity: 1 }] },
  { label: "Unknown product", lines: [{ variantId: "test-var-does-not-exist", quantity: 1 }] },
  { label: "Preview sample (not for sale)", lines: [{ variantId: "pv-berry-slushie-strawberry", quantity: 1 }] },
  { label: "Tampered price ($0.01 sent by browser)", lines: [{ variantId: "test-var-jelly-blue", quantity: 1, price: 1, unitAmount: 1 }] },
  { label: "Empty cart", lines: [] },
];
