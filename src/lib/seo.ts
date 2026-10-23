import type { Metadata } from "next";
import type { Product } from "@/commerce/types";
import { getAvailability, startingPrice } from "@/commerce/availability";
import { purchasingEnabled } from "./features";
import { siteConfig } from "./site";

/**
 * Per-page metadata with a canonical URL. Every page sets its own canonical
 * (a canonical in the root layout would wrongly apply to all pages).
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: siteConfig.name, title: `${title} · ${siteConfig.name}`, description, url: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Organization + WebSite structured data for the homepage. Facts only. */
export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}/brand/funksquish-logo-512.png`,
      email: siteConfig.email,
      sameAs: [siteConfig.tiktok.url],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ];
}

/**
 * Product structured data — ONLY for real, published, purchasable products
 * with a real price and known stock. Preview samples get none, so search
 * engines never see fake prices, stock, ratings or reviews.
 */
export function productJsonLd(product: Product) {
  if (product.publication !== "published" || !purchasingEnabled) return null;
  const price = startingPrice(product);
  const availability = getAvailability(product);
  if (!price || !["in-stock", "low-stock", "sold-out"].includes(availability)) return null;
  const image = product.media.filter((m) => m.type === "image").map((m) => new URL(m.src, siteConfig.url).toString());
  if (image.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image,
    sku: product.variants[0].sku,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: price.currency,
      lowPrice: (price.amount / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: availability === "sold-out" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${siteConfig.url}/shop/${product.slug}`,
    },
  };
}

/** Safe JSON-LD script props (escapes "<" so content can't break out of the tag). */
export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
