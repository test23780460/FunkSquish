import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/commerce/types";

/** canPurchase needs verified shipping only for our own checkout, not for external links (e.g. TikTok Shop). */
const product = (): Product => ({
  id: "p1",
  slug: "p1",
  name: "Squish",
  category: "jelly-squishies",
  publication: "published",
  shortDescription: "",
  description: "",
  media: [],
  art: "jelly",
  variants: [
    {
      id: "v1",
      sku: "S1",
      name: "Blue",
      swatch: "#000",
      palette: { base: "#000", light: "#000", shade: "#000", accent: "#000" },
      price: { amount: 899, currency: "USD" },
      compareAtPrice: null,
      inventory: { tracked: true, available: 10 },
      weightGrams: 80,
      dimensions: null,
      externalPurchaseUrl: "https://shop.tiktok.com/view/product/1",
    },
  ],
  specs: { material: null, fill: null, texture: null, sizeDescription: null },
  safety: { ageGrade: null, warnings: [], careInstructions: [], manufacturerOrImporter: null, countryOfOrigin: null },
  tags: [],
  featuredRank: 1,
  createdAt: "2026-10-27",
});

async function availabilityWith(checkoutMode: string) {
  vi.resetModules();
  vi.doMock("@/lib/features", () => ({
    features: { commerce: true, checkoutMode, newsletter: false, dropAlerts: false, partnerApplications: false, accounts: false },
    purchasingEnabled: true,
  }));
  return import("@/commerce/availability");
}

afterEach(() => {
  vi.doUnmock("@/lib/features");
  vi.resetModules();
});

describe("shipping readiness and what can be bought", () => {
  it("our own checkout: no verified rates for our stock yet → not purchasable, shown as coming soon", async () => {
    const a = await availabilityWith("hosted-checkout");
    const p = product();
    expect(a.canPurchase(p, p.variants[0])).toBe(false);
    expect(a.getAvailability(p, p.variants[0])).toBe("coming-soon");
  });

  it("external links (TikTok Shop): our shipping rates don't apply", async () => {
    const a = await availabilityWith("external-links");
    const p = product();
    expect(a.canPurchase(p, p.variants[0])).toBe(true);
    expect(a.getAvailability(p, p.variants[0])).toBe("in-stock");
  });
});
