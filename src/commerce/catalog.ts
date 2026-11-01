import type { Product } from "./types";
import { previewProducts } from "./providers/preview";
import { localProducts } from "./providers/local";
import { cachedReleaseProducts, freshReleaseProducts } from "./catalog-release";

/**
 * Catalog access layer. Pages only call these functions.
 *
 * Source, in order:
 *  1. The catalog the owner published from the dashboard (a "release"),
 *     when it has at least one product. Changes go live without a deploy.
 *  2. The build-time catalog (src/commerce/data/products.json, generated from
 *     the catalog spreadsheet), when it has any published products.
 *  3. Otherwise the illustrated preview samples.
 * Import the spreadsheet into the dashboard (Products → Import) to move from
 * 2 to 1; once a release exists it replaces the build-time catalog.
 */
export type CatalogSource = "preview" | "local" | "release";

const visible = (p: Product) => p.publication === "published" || p.publication === "preview";

function pick(released: Product[] | null): { source: CatalogSource; products: Product[] } {
  if (released && released.length) return { source: "release", products: released.filter(visible) };
  if (localProducts.some((p) => p.publication === "published")) return { source: "local", products: localProducts.filter(visible) };
  return { source: "preview", products: previewProducts };
}

async function resolve() {
  return pick(await cachedReleaseProducts());
}

export async function listProducts(): Promise<Product[]> {
  return (await resolve()).products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await resolve()).products.find((p) => p.slug === slug);
}

/** True while the shop only contains illustrative samples. */
export async function catalogIsPreview(): Promise<boolean> {
  return (await resolve()).source === "preview";
}

export async function catalogSource(): Promise<CatalogSource> {
  return (await resolve()).source;
}

/** Checkout's copy: the published release read fresh (an unreadable store fails checkout closed), else the build-time catalog. */
export async function listProductsForCheckout(): Promise<Product[]> {
  return pick(await freshReleaseProducts()).products;
}

// Pure helpers live in ./availability (safe for client bundles); re-exported for convenience.
export * from "./availability";
