/**
 * Checkout provider selection for REAL purchases.
 *
 * Decision B4 (Oct 24, 2026): Stripe Checkout on funksquish.com, TikTok Shop
 * separately, PayPal possibly later. Only TEST-mode preparation is approved,
 * so there is deliberately no live provider here: this always refuses.
 * The Stripe test integration lives in src/commerce/checkout/ and is gated
 * separately so it can never run on production.
 *
 * A live provider must come in a separate, owner-approved launch PR — not by
 * swapping a live key into the test code.
 */
import { features } from "@/lib/features";

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
  constructor(message = "Checkout is not enabled.") {
    super(message);
    this.name = "CheckoutDisabledError";
  }
}

export function getCheckoutProvider(): CheckoutProvider {
  if (!features.commerce || features.checkoutMode !== "hosted-checkout") throw new CheckoutDisabledError();
  throw new CheckoutDisabledError("Live checkout has not been approved (B4 covers test mode only).");
}
