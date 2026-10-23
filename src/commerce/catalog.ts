import type { Product } from "./types";
import { previewProducts } from "./providers/preview";
import { localProducts } from "./providers/local";

/**
 * Catalog access layer. Pages only call these functions.
 *
 * Source selection:
 *  - If the local catalog (src/commerce/data/products.json, generated from the
 *    catalog template) contains any published products, it is used.
 *  - Otherwise the illustrated preview samples are shown.
 * A hosted provider (e.g. Shopify) can replace `localProvider` later with the
 * same interface.
 */
export interface CatalogProvider {
  id: "preview" | "local" | "shopify";
  listProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | undefined>;
}

const visible = (p: Product) => p.publication === "published" || p.publication === "preview";

const previewProvider: CatalogProvider = {
  id: "preview",
  async listProducts() {
    return previewProducts;
  },
  async getProduct(slug) {
    return previewProducts.find((p) => p.slug === slug);
  },
};

const localProvider: CatalogProvider = {
  id: "local",
  async listProducts() {
    return localProducts.filter(visible);
  },
  async getProduct(slug) {
    return localProducts.filter(visible).find((p) => p.slug === slug);
  },
};

const provider: CatalogProvider = localProducts.some((p) => p.publication === "published")
  ? localProvider
  : previewProvider;

/** True while the shop only contains illustrative samples. */
export const isPreviewCatalog = provider.id === "preview";

export function listProducts() {
  return provider.listProducts();
}

export function getProduct(slug: string) {
  return provider.getProduct(slug);
}

// Pure helpers live in ./availability (safe for client bundles); re-exported for convenience.
export * from "./availability";
