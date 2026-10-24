import { listProducts } from "../catalog";
import type { CheckoutLine, CheckoutProvider } from "../provider";

/**
 * B4 implementation — TEST MODE ONLY. Refuses to run in Netlify production,
 * refuses sk_live_ keys, and always requires an explicit test shipping rate.
 * No order storage, stock reservation or fulfillment is implemented here.
 */
export function stripeTestEnvironmentAllowed(): boolean {
  return process.env.BUILD_CONTEXT === "deploy-preview" || process.env.NODE_ENV === "development";
}

function returnOrigin(): string | null {
  const supplied = process.env.STRIPE_TEST_RETURN_ORIGIN || process.env.DEPLOY_PRIME_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!supplied) return null;
  try {
    const url = new URL(supplied);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password) return null;
    if (url.hostname === "funksquish.com" || url.hostname === "www.funksquish.com") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configured(): boolean {
  return stripeTestEnvironmentAllowed() &&
    !!process.env.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") &&
    !!process.env.STRIPE_TEST_SHIPPING_RATE_ID?.startsWith("shr_") &&
    returnOrigin() !== null;
}

export const stripeTestCheckoutProvider: CheckoutProvider = {
  id: "stripe-test",

  isConfigured: configured,

  async createCheckout(lines: CheckoutLine[]) {
    if (!configured()) throw new Error("Stripe test checkout is unavailable.");
    const key = process.env.STRIPE_TEST_SECRET_KEY!;
    const shippingRate = process.env.STRIPE_TEST_SHIPPING_RATE_ID!;
    const origin = returnOrigin()!;
    if (lines.length < 1 || lines.length > 20) throw new Error("Invalid cart size.");

    // Defense in depth: all pricing comes from the server catalog, never the cart.
    const products = await listProducts();
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", `${origin}/checkout/test-result?status=returned&session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${origin}/checkout/test-result?status=cancelled`);
    body.set("shipping_address_collection[allowed_countries][0]", "US");
    body.set("shipping_options[0][shipping_rate]", shippingRate);
    body.set("metadata[source]", "funksquish-stripe-test");

    const seen = new Set<string>();
    for (const [index, line] of lines.entries()) {
      if (seen.has(line.variantId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) {
        throw new Error("Invalid cart quantity.");
      }
      seen.add(line.variantId);
      const product = products.find((p) => p.publication === "published" && p.variants.some((v) => v.id === line.variantId));
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product || !variant || variant.sku !== line.sku || !variant.price ||
          !Number.isSafeInteger(variant.price.amount) || variant.price.amount < 50 ||
          variant.price.currency !== "USD" || !variant.inventory.tracked ||
          variant.inventory.available === null || variant.inventory.available < line.quantity) {
        throw new Error("A product is not currently eligible for test checkout.");
      }
      const prefix = `line_items[${index}]`;
      body.set(`${prefix}[price_data][currency]`, "usd");
      body.set(`${prefix}[price_data][unit_amount]`, String(variant.price.amount));
      body.set(`${prefix}[price_data][product_data][name]`, `${product.name} — ${variant.name}`);
      body.set(`${prefix}[price_data][product_data][metadata][sku]`, variant.sku);
      body.set(`${prefix}[quantity]`, String(line.quantity));
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });
    if (!response.ok) {
      // Do not log Stripe responses; they may contain sensitive details.
      throw new Error(`Stripe test session failed (HTTP ${response.status}).`);
    }
    const json = (await response.json()) as { id?: string; url?: string; livemode?: boolean };
    if (json.livemode !== false || !json.id?.startsWith("cs_test_") || !json.url ||
        new URL(json.url).hostname !== "checkout.stripe.com") {
      throw new Error("Unexpected Stripe test session response.");
    }
    return { url: json.url };
  },
};
