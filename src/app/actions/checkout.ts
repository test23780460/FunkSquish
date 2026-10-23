"use server";

import { listProducts, canPurchase } from "@/commerce/catalog";
import { getCheckoutProvider, CheckoutDisabledError } from "@/commerce/provider";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const MAX_QTY_PER_LINE = 10;

/**
 * Start a hosted checkout. Never trusts the browser: every line is re-checked
 * against the catalog (published, purchasable, enough stock) before the
 * provider is called. Prices are always taken from the provider, not the client.
 */
export async function startCheckout(lines: { variantId: string; quantity: number }[]): Promise<CheckoutResult> {
  try {
    const provider = getCheckoutProvider(); // throws while purchasing is switched off
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) return { ok: false, error: "Your cart is empty." };

    const products = await listProducts();
    const checked = [];
    for (const line of lines) {
      const qty = Math.floor(Number(line.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return { ok: false, error: "Please check the quantities in your cart." };
      const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product || !variant || !canPurchase(product, variant)) return { ok: false, error: "An item in your cart is no longer available." };
      if (variant.inventory.available !== null && qty > variant.inventory.available)
        return { ok: false, error: `Only ${variant.inventory.available} of ${product.name} (${variant.name}) left.` };
      checked.push({ variantId: variant.id, sku: variant.sku, quantity: qty });
    }

    const { url } = await provider.createCheckout(checked);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof CheckoutDisabledError) return { ok: false, error: "Checkout isn't open yet." };
    console.error("[checkout]", err);
    return { ok: false, error: "We couldn't start checkout. Please try again." };
  }
}
