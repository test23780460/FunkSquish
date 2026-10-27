import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateProducts } from "@/commerce/validate";
import type { Product } from "@/commerce/types";

/**
 * Runs on every `npm test`, even if nobody ran `npm run catalog:check`:
 * a PUBLISHED product can't reach the public catalog without the public
 * facts the policies and product-safety rules depend on. (The private
 * documents — CPC, lab report, invoice — are checked by catalog:check,
 * which reads the git-ignored private/ folder.)
 */
const products = validateProducts(JSON.parse(readFileSync(join(process.cwd(), "src/commerce/data/products.json"), "utf8"))) as Product[];

export function publishedProblems(p: Product): string[] {
  if (p.publication !== "published") return [];
  const out: string[] = [];
  if (!p.media.some((m) => m.type === "image")) out.push("no product photo");
  if (!p.safety.ageGrade) out.push("no age grading");
  if (!p.safety.manufacturerOrImporter) out.push("no manufacturer/importer");
  if (!p.specs.material) out.push("no material");
  for (const v of p.variants) {
    if (!v.price) out.push(`${v.sku}: no price`);
    if (!v.weightGrams) out.push(`${v.sku}: no weight`);
    if (!v.inventory.tracked || v.inventory.available === null) out.push(`${v.sku}: stock not tracked`);
    if (v.compareAtPrice && v.price && v.compareAtPrice.amount <= v.price.amount) out.push(`${v.sku}: compare-at not higher than price`);
  }
  const mystery = p.tags.some((t) => /mystery|blind/i.test(t)) || /mystery|blind/i.test(p.name);
  if (mystery && p.salesTerms?.finalSaleOnceOpened === undefined) out.push("mystery/blind-bag item without an explicit final_sale_once_opened decision");
  return out;
}

describe("published products carry the facts our policies promise", () => {
  it("every published product passes", () => {
    for (const p of products) expect(publishedProblems(p), p.slug).toEqual([]);
  });

  it("the check itself catches the gaps (guards against a check that never fails)", () => {
    const bare: Product = {
      id: "x", slug: "x", name: "Mystery Squish Bag", category: "cute-collectibles", publication: "published", shortDescription: "s", description: "d",
      media: [], art: "capsule", tags: [], featuredRank: 1, createdAt: "2026-10-27",
      specs: { material: null, fill: null, texture: null, sizeDescription: null },
      safety: { ageGrade: null, warnings: [], careInstructions: [], manufacturerOrImporter: null, countryOfOrigin: null },
      variants: [{ id: "v", sku: "S", name: "n", swatch: "#000000", palette: { base: "#000", light: "#fff", shade: "#000", accent: "#fff" }, price: null, compareAtPrice: null, inventory: { tracked: false, available: null }, weightGrams: null, dimensions: null, externalPurchaseUrl: null }],
    };
    const problems = publishedProblems(bare);
    for (const expected of ["no product photo", "no age grading", "no manufacturer/importer", "S: no price", "S: no weight", "S: stock not tracked", "mystery/blind-bag item without an explicit final_sale_once_opened decision"])
      expect(problems).toContain(expected);
  });
});
