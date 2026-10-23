import type { Product, ProductStatus, ProductVariant } from "./types";
import { previewProducts } from "./providers/preview";

/**
 * Catalog access layer.
 *
 * Pages only call these functions. At launch, swap the provider below for a
 * real one (e.g. Shopify Storefront API) that returns the same `Product` shape.
 */
interface CatalogProvider {
  listProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | undefined>;
}

const previewProvider: CatalogProvider = {
  async listProducts() {
    return previewProducts;
  },
  async getProduct(slug) {
    return previewProducts.find((p) => p.slug === slug);
  },
};

const provider: CatalogProvider = previewProvider;

/** True while the shop only contains illustrative samples. */
export const isPreviewCatalog = provider === previewProvider;

export function listProducts() {
  return provider.listProducts();
}

export function getProduct(slug: string) {
  return provider.getProduct(slug);
}

/* ---------- Pure helpers shared by server + client components ---------- */

export function formatMoney(money: ProductVariant["price"]): string {
  if (!money) return "Price TBA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: money.currency }).format(
    money.amount / 100,
  );
}

/** Lowest variant price, or null if no variant is priced yet. */
export function startingPrice(product: Product) {
  const prices = product.variants.flatMap((v) => (v.price ? [v.price] : []));
  if (prices.length === 0) return null;
  return prices.reduce((min, p) => (p.amount < min.amount ? p : min));
}

export function isPurchasable(status: ProductStatus) {
  return status === "available";
}

export const statusLabel: Record<ProductStatus, string> = {
  preview: "Preview sample",
  "coming-soon": "Coming soon",
  available: "In stock",
  "sold-out": "Sold out",
};
