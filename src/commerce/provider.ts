/**
 * Checkout provider interface (server-side).
 *
 * The site never handles card data. A provider only turns cart lines into a
 * URL on the provider's own secure, hosted checkout page.
 *
 * Only import this from Server Actions / server components — it reads secrets
 * from environment variables.
 */
import { features } from "@/lib/features";
import { shopifyCheckoutProvider } from "./providers/shopify-checkout";

export interface CheckoutLine {
  /** Provider variant id (for Shopify: the ProductVariant GID). */
  variantId: string;
  sku: string;
  quantity: number;
}

export interface CheckoutProvider {
  id: string;
  /** True when credentials are present. */
  isConfigured(): boolean;
  /** Create a hosted checkout session and return its URL. */
  createCheckout(lines: CheckoutLine[]): Promise<{ url: string }>;
}

export class CheckoutDisabledError extends Error {
  constructor(reason = "Checkout is not open yet.") {
    super(reason);
  }
}

/** Returns a usable provider, or throws if purchasing is not fully switched on. */
export function getCheckoutProvider(): CheckoutProvider {
  if (!features.commerce || features.checkoutMode !== "hosted-checkout") throw new CheckoutDisabledError();
  const provider = shopifyCheckoutProvider;
  if (!provider.isConfigured()) throw new CheckoutDisabledError("Checkout provider is not configured.");
  return provider;
}
