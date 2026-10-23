import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { listProducts } from "@/commerce/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/shop", "/our-story", "/tiktok-live", "/faq", "/contact"];
  const products = await listProducts();
  return [
    ...pages.map((path) => ({ url: `${siteConfig.url}${path}` })),
    ...products.map((p) => ({ url: `${siteConfig.url}/shop/${p.slug}` })),
  ];
}
