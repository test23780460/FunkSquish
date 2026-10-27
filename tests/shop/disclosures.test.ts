import { describe, expect, it, vi } from "vitest";

// Pretend the shop is open (external "Buy now" links), so purchase controls render live.
vi.mock("@/lib/features", () => ({
  features: { commerce: true, checkoutMode: "external-links", newsletter: false, dropAlerts: false, partnerApplications: false, accounts: false },
  purchasingEnabled: true,
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Product } from "@/commerce/types";
import { ProductShowcase } from "@/components/shop/ProductShowcase";
import { ProductCard } from "@/components/shop/ProductCard";
import { needsDisclosureBeforePurchase, STANDARD_PROCESSING_BUSINESS_DAYS } from "@/commerce/sales-terms";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "test-squishy",
    name: "Test Squishy",
    category: "jelly-squishies",
    publication: "published",
    shortDescription: "Short.",
    description: "Long.",
    media: [],
    art: "jelly",
    variants: [
      {
        id: "v1",
        sku: "FS-TEST-1",
        name: "Blue",
        swatch: "#4ea8ff",
        palette: { base: "#4ea8ff", light: "#b8dcff", shade: "#3776b3", accent: "#ffffff" },
        price: { amount: 899, currency: "USD" },
        compareAtPrice: null,
        inventory: { tracked: true, available: 20 },
        weightGrams: 80,
        dimensions: null,
        externalPurchaseUrl: "https://shop.tiktok.com/view/product/1",
      },
    ],
    specs: { material: "TPR", fill: "Gel", texture: "Jelly", sizeDescription: "8 cm" },
    safety: { ageGrade: "Ages 3+", warnings: [], careInstructions: [], manufacturerOrImporter: "Example Toys Inc.", countryOfOrigin: "China" },
    tags: [],
    featuredRank: 1,
    createdAt: "2026-10-27",
    ...overrides,
  };
}

const showcase = (p: Product) => renderToStaticMarkup(createElement(ProductShowcase, { product: p, themeSoft: "", header: null }));
const card = (p: Product) => renderToStaticMarkup(createElement(ProductCard, { product: p }));
const WARNING = "WARNING: CHOKING HAZARD — Small parts. Not for children under 3 yrs.";

describe("disclosures before purchase", () => {
  it("a plain product can be bought straight from its card", () => {
    const p = product();
    expect(needsDisclosureBeforePurchase(p)).toBe(false);
    expect(card(p)).toContain("Buy now");
    expect(showcase(p)).toContain("Buy now");
  });

  it("shows label warnings in the buy box, before the first buy button", () => {
    const html = showcase(product({ safety: { ...product().safety, warnings: [WARNING] } }));
    const warningAt = html.indexOf("CHOKING HAZARD");
    const buyAt = html.indexOf("Buy now");
    expect(warningAt).toBeGreaterThan(-1);
    expect(buyAt).toBeGreaterThan(warningAt);
    expect(html).toContain('aria-label="Safety warning"');
  });

  it("states 'final sale once opened' and the processing time before the buy button", () => {
    const html = showcase(product({ salesTerms: { finalSaleOnceOpened: true, processingBusinessDays: 5 } }));
    const buyAt = html.indexOf("Buy now");
    expect(html.indexOf("Final sale once opened")).toBeGreaterThan(-1);
    expect(html.indexOf("Final sale once opened")).toBeLessThan(buyAt);
    expect(html.indexOf("Ships within 5 business days")).toBeLessThan(buyAt);
  });

  it("shows the standard processing time for ordinary published products", () => {
    expect(STANDARD_PROCESSING_BUSINESS_DAYS).toBe(2);
    expect(showcase(product())).toContain("Ships within 2 business days");
  });

  it("cards for products needing a disclosure send shoppers to the product page instead of selling directly", () => {
    for (const p of [
      product({ safety: { ...product().safety, warnings: [WARNING] } }),
      product({ salesTerms: { finalSaleOnceOpened: true } }),
      product({ salesTerms: { processingBusinessDays: 7 } }),
    ]) {
      const html = card(p);
      expect(html).toContain("See details to buy");
      expect(html).not.toContain("Buy now");
    }
  });

  it("the mobile sticky bar doesn't offer a direct buy button when a disclosure is needed", () => {
    const html = showcase(product({ safety: { ...product().safety, warnings: [WARNING] } }));
    expect(html).toContain("See warning &amp; buy");
    // Only one direct purchase control: the one in the buy box, below the warning.
    expect(html.split("Buy now").length - 1).toBe(1);
  });

  it("preview samples never show shipping-time promises", () => {
    expect(showcase(product({ publication: "preview" }))).not.toContain("Ships within");
  });
});
