import type { Product } from "./types";

/**
 * What the product page must show next to the buy button, and why:
 *
 *  - Label warnings (e.g. a choking-hazard statement): 16 CFR 1500.20 requires
 *    required cautionary statements in any advertising that offers a direct way
 *    to buy, so they can't hide in a collapsed section below the button.
 *  - "Final sale once opened": the Returns Policy only excludes opened mystery /
 *    blind-bag items from change-of-mind returns "where clearly disclosed before
 *    purchase".
 *  - Processing time: the Shipping Policy promises 2 business days for our own
 *    stock and that any longer time is disclosed before checkout.
 *
 * Product cards don't repeat all of this, so a card for a product that needs a
 * disclosure links to its product page instead of offering a buy button.
 */

/** Owner-approved processing time for our own stock (Shipping Policy, decision S1). */
export const STANDARD_PROCESSING_BUSINESS_DAYS = 2;

export function processingBusinessDays(product: Pick<Product, "salesTerms">): number {
  return product.salesTerms?.processingBusinessDays ?? STANDARD_PROCESSING_BUSINESS_DAYS;
}

export function isFinalSaleOnceOpened(product: Pick<Product, "salesTerms">): boolean {
  return product.salesTerms?.finalSaleOnceOpened === true;
}

export function hasLabelWarnings(product: Pick<Product, "safety">): boolean {
  return product.safety.warnings.some((w) => w.trim() !== "");
}

/** True when buying must happen on the product page, where every disclosure is shown before the buy button. */
export function needsDisclosureBeforePurchase(product: Pick<Product, "safety" | "salesTerms">): boolean {
  return hasLabelWarnings(product) || isFinalSaleOnceOpened(product) || processingBusinessDays(product) !== STANDARD_PROCESSING_BUSINESS_DAYS;
}
