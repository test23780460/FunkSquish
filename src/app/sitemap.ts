import type { MetadataRoute } from "next";
import { listProducts } from "@/commerce/catalog";
import { CANONICAL_ORIGIN, INDEXABLE_PATHS } from "@/lib/indexing";

/**
 * Only indexable, canonical URLs are listed (see src/lib/indexing.ts). Draft policies, private pages and illustrated preview
 * products are deliberately left out — they are also marked noindex on the page itself.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = (await listProducts()).filter((p) => p.publication === "published");
  return [
    ...INDEXABLE_PATHS.map((path) => ({ url: `${CANONICAL_ORIGIN}${path}` })),
    ...products.map((p) => ({ url: `${CANONICAL_ORIGIN}/shop/${p.slug}` })),
  ];
}
