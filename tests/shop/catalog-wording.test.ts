import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * "Sample"/"preview" wording must follow the catalog: it appears while the
 * shop only holds illustrated samples, and goes away once real products are
 * imported — without the owner having to rewrite pages on launch day.
 */
vi.mock("server-only", () => ({}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Product } from "@/commerce/types";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { previewProducts } from "@/commerce/providers/preview";

function real(overrides: Partial<Product> = {}): Product {
  return {
    ...previewProducts[0],
    id: "real-1",
    slug: "real-squishy",
    name: "Real Squishy",
    publication: "published",
    ...overrides,
  };
}

const catalog = (products: Product[]) => renderToStaticMarkup(createElement(ShopCatalog, { products }));

describe("shop catalog wording", () => {
  it("illustrated samples only: says samples and searches the preview catalog", () => {
    const html = catalog(previewProducts);
    expect(html).toContain(`${previewProducts.length} samples shown`);
    expect(html).toContain("Search the preview catalog");
    expect(html).toContain(">Sample designs</h2>");
  });

  it("real products: no 'sample' wording", () => {
    const html = catalog([real(), real({ id: "real-2", slug: "real-2", name: "Real Two" })]);
    expect(html).toContain("2 squishies shown");
    expect(html).toContain("Search the shop");
    expect(html).not.toMatch(/samples? shown|preview catalog/i);
  });

  it("a mix still uses product wording (each sample keeps its own badge)", () => {
    const html = catalog([real(), previewProducts[1]]);
    expect(html).toContain("2 squishies shown");
    expect(html).toContain("Preview sample"); // the sample's own card badge
  });

  it("one real product reads naturally", () => {
    expect(catalog([real()])).toContain("1 squishy shown");
  });
});

describe("pages switch on the catalog flag, not hard-coded copy", () => {
  const read = (f: string) => readFileSync(f, "utf8");

  it("shop page: preview title and notice only while every product is a sample; 'ordering isn't open' until purchasing is on", () => {
    const page = read("src/app/shop/page.tsx");
    expect(page).toContain("isPreviewCatalog");
    expect(page).toMatch(/allPreview \? \(\s*<Notice\s+title="These are sample illustrations, not real products"/);
    expect(page).toMatch(/!allPreview && !purchasingEnabled && \(\s*<Notice title="Ordering isn't open yet"/);
  });

  it("home, Squish Lab and TikTok LIVE pages use the same flag", () => {
    for (const f of ["src/components/home/Hero.tsx", "src/components/home/Collections.tsx", "src/components/home/SquishLabTeaser.tsx", "src/app/squish-lab/page.tsx", "src/app/tiktok-live/page.tsx"])
      expect(read(f), f).toContain("isPreviewCatalog");
  });
});
