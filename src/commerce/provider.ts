/**
 * Hosted checkout provider selection.
 * Purchasing stays disabled until the owner explicitly launches it.
 * During preparation Stripe can run only with sk_test_ keys on local dev
 * or deploy previews. It cannot accept live credentials or run in production.
 */
import { features } from "@/lib/features";
import { stripeTestCheckoutProvider } from "./providers/stripe-test-checkout";

export interface CheckoutLine {
  variantId: string;
  sku: string;
  quantity: number;
}

export interface CheckoutProvider {
  id: string;
  isConfigured(): boolean;
  createCheckout(lines: CheckoutLine[]): Promise<{ url: string }>;
}

export class CheckoutDisabledError extends Error {
  constructor(reason = "Checkout is not open yet.") {
    super(reason);
  }
}

export function getCheckoutProvider(): CheckoutProvider {
  if (!features.commerce || features.checkoutMode !== "hosted-checkout") {
    throw new CheckoutDisabledError();
  }
  // B4 approved: Stripe test mode only. TikTok Shop remains a separate channel.
  const provider = stripeTestCheckoutProvider;
  if (!provider.isConfigured()) throw new CheckoutDisabledError("Stripe test checkout is not configured.");
  return provider;
}
