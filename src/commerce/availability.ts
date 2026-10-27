import type { Availability, Money, Product, ProductVariant } from "./types";
import { features, purchasingEnabled } from "@/lib/features";
import { variantShippingReady } from "./origins";

/**
 * Our own checkout needs verified shipping for where the variant ships from
 * (src/commerce/origins.ts). Selling through external links (e.g. TikTok Shop)
 * uses that channel's shipping, so our rates don't apply there.
 */
function shippingReadyForCheckout(variant: ProductVariant): boolean {
  return features.checkoutMode !== "hosted-checkout" || variantShippingReady(variant);
}

/**
 * Pure pricing/availability helpers. No catalog data is imported here, so
 * client components can use them without bundling the product list.
 */

/** Below this many units a published, sellable variant shows "Only a few left". */
export const LOW_STOCK_THRESHOLD = 3;

export function formatMoney(money: Money | null): string {
  if (!money) return "Price TBA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: money.currency }).format(money.amount / 100);
}

/** Lowest variant price, or null if no variant is priced yet. */
export function startingPrice(product: Product) {
  const prices = product.variants.flatMap((v) => (v.price ? [v.price] : []));
  if (prices.length === 0) return null;
  return prices.reduce((min, p) => (p.amount < min.amount ? p : min));
}

/** A compare-at price is only shown when it is real and higher than the price. */
export function showCompareAt(variant: ProductVariant) {
  return !!variant.price && !!variant.compareAtPrice && variant.compareAtPrice.amount > variant.price.amount;
}

/**
 * What we tell shoppers about a variant. Conservative by design:
 * stock is only claimed when the product is published, selling is switched
 * on, the variant has a price, and inventory is tracked with a known count.
 */
export function getAvailability(product: Product, variant?: ProductVariant): Availability {
  if (product.publication === "preview") return "preview";
  if (product.publication !== "published") return "unavailable";

  const variants = variant ? [variant] : product.variants;
  const known = variants.filter((v) => v.inventory.tracked && v.inventory.available !== null);
  const allSoldOut = known.length === variants.length && known.every((v) => (v.inventory.available ?? 0) <= 0);
  if (allSoldOut) return "sold-out";

  // Sellable only with a price AND (for our own checkout) verified shipping from where it ships.
  const sellable = purchasingEnabled && variants.some((v) => v.price !== null && shippingReadyForCheckout(v));
  if (!sellable || known.length === 0) return "coming-soon";

  const units = known.reduce((sum, v) => sum + Math.max(0, v.inventory.available ?? 0), 0);
  if (units <= 0) return "sold-out";
  return units <= LOW_STOCK_THRESHOLD ? "low-stock" : "in-stock";
}

export const availabilityLabel: Record<Availability, string> = {
  preview: "Preview sample",
  "coming-soon": "Coming soon",
  "in-stock": "In stock",
  "low-stock": "Only a few left",
  "sold-out": "Sold out",
  unavailable: "Unavailable",
};

/** Purchasable only when every safety gate is open — including, for our own checkout, verified shipping for where it ships from. */
export function canPurchase(product: Product, variant: ProductVariant) {
  const a = getAvailability(product, variant);
  return purchasingEnabled && (a === "in-stock" || a === "low-stock") && variant.price !== null && shippingReadyForCheckout(variant);
}
