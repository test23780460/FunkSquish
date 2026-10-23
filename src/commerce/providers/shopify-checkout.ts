import type { CheckoutLine, CheckoutProvider } from "../provider";

/**
 * Shopify hosted checkout via the Storefront API (cartCreate -> checkoutUrl).
 *
 * PREPARED, NOT ACTIVE. It is only reachable when `features.commerce` is true,
 * `features.checkoutMode` is "hosted-checkout", and these server env vars exist:
 *   SHOPIFY_STORE_DOMAIN       e.g. funksquish.myshopify.com
 *   SHOPIFY_STOREFRONT_TOKEN   Storefront API access token (never NEXT_PUBLIC_)
 *   SHOPIFY_API_VERSION        optional, e.g. 2026-07
 *   SHOPIFY_CHECKOUT_HOST      optional, your Shopify custom checkout domain
 *
 * Shopify needs a plan that includes Storefront API / Headless access
 * (see docs/ECOMMERCE-ROADMAP.md). Payment, tax and card data stay on Shopify.
 */
const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { checkoutUrl }
      userErrors { message }
    }
  }
`;

export const shopifyCheckoutProvider: CheckoutProvider = {
  id: "shopify",

  isConfigured() {
    return !!process.env.SHOPIFY_STORE_DOMAIN && !!process.env.SHOPIFY_STOREFRONT_TOKEN;
  },

  async createCheckout(lines: CheckoutLine[]) {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
    const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
    if (!domain || !token) throw new Error("Shopify is not configured.");

    const res = await fetch(`https://${domain}/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
      body: JSON.stringify({
        query: CART_CREATE,
        variables: { lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })) },
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Shopify responded ${res.status}`);
    const json = (await res.json()) as {
      data?: { cartCreate?: { cart?: { checkoutUrl?: string }; userErrors?: { message: string }[] } };
    };
    const errors = json.data?.cartCreate?.userErrors ?? [];
    const url = json.data?.cartCreate?.cart?.checkoutUrl;
    if (errors.length || !url) throw new Error(errors[0]?.message ?? "Could not start checkout.");
    // Only ever redirect to Shopify-hosted checkout pages.
    const host = new URL(url).hostname;
    const allowed = [domain, process.env.SHOPIFY_CHECKOUT_HOST].filter(Boolean);
    if (!(host.endsWith(".myshopify.com") || host === "shopify.com" || host.endsWith(".shopify.com") || allowed.includes(host)))
      throw new Error("Unexpected checkout host.");
    return { url };
  },
};
