import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { listProducts } from "@/commerce/catalog";

/**
 * Only indexable pages are listed. Draft policies (privacy, terms) and illustrated preview products are deliberately left out — they
 * are also marked noindex on the page itself.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/shop", "/squish-lab", "/quiz", "/squish-box", "/drops", "/our-story", "/tiktok-live", "/faq", "/contact", "/order-help", "/product-care", "/shipping", "/returns"];
  const products = (await listProducts()).filter((p) => p.publication === "published");
  return [
    ...pages.map((path) => ({ url: `${siteConfig.url}${path}` })),
    ...products.map((p) => ({ url: `${siteConfig.url}/shop/${p.slug}` })),
  ];
}
