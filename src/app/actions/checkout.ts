"use server";

import { listProducts, canPurchase } from "@/commerce/catalog";
import { getCheckoutProvider, CheckoutDisabledError } from "@/commerce/provider";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const MAX_QTY_PER_LINE = 10;

/**
 * Server-side cart validation. Preview samples, unknown stock, unpriced items,
 * fractional quantities and duplicate variant IDs cannot reach Stripe.
 */
export async function startCheckout(lines: { variantId: string; quantity: number }[]): Promise<CheckoutResult> {
  try {
    const provider = getCheckoutProvider(); // disabled during pre-launch
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) return { ok: false, error: "Your cart is empty." };

    const products = await listProducts();
    const checked = [];
    const seen = new Set<string>();
    for (const line of lines) {
      if (!line || typeof line.variantId !== "string" || !line.variantId || seen.has(line.variantId) ||
          !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QTY_PER_LINE) {
        return { ok: false, error: "Please check the items and quantities in your cart." };
      }
      seen.add(line.variantId);
      const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product || !variant || !canPurchase(product, variant)) return { ok: false, error: "An item in your cart is no longer available." };
      if (variant.inventory.available !== null && line.quantity > variant.inventory.available) {
        return { ok: false, error: `Only ${variant.inventory.available} of ${product.name} (${variant.name}) left.` };
      }
      checked.push({ variantId: variant.id, sku: variant.sku, quantity: line.quantity });
    }
    const { url } = await provider.createCheckout(checked);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof CheckoutDisabledError) return { ok: false, error: "Checkout isn't open yet." };
    console.error("[checkout] Could not create session:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "We couldn't start checkout. Please try again." };
  }
}
