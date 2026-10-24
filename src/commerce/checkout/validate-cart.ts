import type { FulfillmentSource, Product, ProductVariant } from "../types";

/**
 * Server-side cart validation. Pure (no I/O) so it is fully unit-tested.
 *
 * The browser only ever sends { variantId, quantity }. Everything else —
 * price, name, SKU, stock, who ships it — is looked up here from the
 * server's catalog. Client-supplied prices are ignored by design.
 */

export const MAX_QTY_PER_ITEM = 10;
export const MAX_CART_LINES = 20;
/** Stripe's minimum charge for USD is $0.50. */
export const MIN_UNIT_AMOUNT_CENTS = 50;

export interface CheckedLine {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  /** Integer cents, from the server catalog. */
  unitAmount: number;
  currency: "usd";
  fulfillmentSource: FulfillmentSource;
}

export type CartErrorCode = "empty" | "too-many-lines" | "bad-line" | "bad-quantity" | "too-many-of-one" | "unavailable" | "not-enough-stock";

export type CartResult<T> = { ok: true; value: T } | { ok: false; code: CartErrorCode; message: string };

const fail = (code: CartErrorCode, message: string) => ({ ok: false as const, code, message });

const VARIANT_ID = /^[A-Za-z0-9_\-:/.]{1,200}$/;

/** Shape-check raw input and merge duplicate entries for the same variant. */
export function normalizeCartLines(raw: unknown): CartResult<{ variantId: string; quantity: number }[]> {
  if (!Array.isArray(raw) || raw.length === 0) return fail("empty", "Your cart is empty.");
  if (raw.length > MAX_CART_LINES) return fail("too-many-lines", `Your cart can hold up to ${MAX_CART_LINES} different items.`);

  const merged = new Map<string, number>();
  for (const line of raw) {
    if (!line || typeof line !== "object") return fail("bad-line", "Something in your cart looks wrong. Please remove it and add it again.");
    const { variantId, quantity } = line as { variantId?: unknown; quantity?: unknown };
    if (typeof variantId !== "string" || !VARIANT_ID.test(variantId)) {
      return fail("bad-line", "Something in your cart looks wrong. Please remove it and add it again.");
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      return fail("bad-quantity", `Quantities must be whole numbers from 1 to ${MAX_QTY_PER_ITEM}.`);
    }
    merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
  }

  for (const qty of merged.values()) {
    if (qty > MAX_QTY_PER_ITEM) return fail("too-many-of-one", `You can buy up to ${MAX_QTY_PER_ITEM} of each item per order.`);
  }
  return { ok: true, value: [...merged].map(([variantId, quantity]) => ({ variantId, quantity })) };
}

/**
 * Check normalized lines against the catalog. `isSellable` decides whether a
 * product may be bought in the current mode (test fixtures in test mode,
 * `canPurchase` once a real launch is approved).
 */
export function validateCartAgainstCatalog(
  lines: { variantId: string; quantity: number }[],
  products: Product[],
  isSellable: (product: Product, variant: ProductVariant) => boolean,
): CartResult<CheckedLine[]> {
  const checked: CheckedLine[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant || product.publication !== "published" || !isSellable(product, variant)) {
      return fail("unavailable", "An item in your cart isn't available right now. Please remove it to continue.");
    }
    const price = variant.price;
    if (!price || price.currency !== "USD" || !Number.isSafeInteger(price.amount) || price.amount < MIN_UNIT_AMOUNT_CENTS || !variant.sku) {
      return fail("unavailable", `${product.name} (${variant.name}) can't be bought right now. Please remove it to continue.`);
    }
    const stock = variant.inventory;
    if (!stock.tracked || stock.available === null || stock.available <= 0) {
      return fail("unavailable", `${product.name} (${variant.name}) is sold out. Please remove it to continue.`);
    }
    if (line.quantity > stock.available) {
      return fail("not-enough-stock", `Only ${stock.available} of ${product.name} (${variant.name}) left. Please lower the quantity.`);
    }
    checked.push({
      variantId: variant.id,
      productId: product.id,
      sku: variant.sku,
      name: `${product.name} — ${variant.name}`,
      quantity: line.quantity,
      unitAmount: price.amount,
      currency: "usd",
      fulfillmentSource: variant.fulfillmentSource ?? "in_house",
    });
  }
  return { ok: true, value: checked };
}
