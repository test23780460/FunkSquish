"use server";

import { testCheckoutEnabled } from "@/commerce/checkout/environment";
import { liveCheckoutEnabled } from "@/commerce/checkout/live";
import { startLiveCheckout, startTestCheckout } from "@/commerce/checkout/service";
import { CheckoutDisabledError, getCheckoutProvider } from "@/commerce/provider";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Start a hosted Stripe Checkout. The browser sends only variant ids and
 * quantities; prices, stock and eligibility are re-checked on the server.
 *
 * - Stripe TEST mode: only on Deploy Previews / local dev with the test
 *   switch on (see src/commerce/checkout/environment.ts), and only for the
 *   labeled test fixtures.
 * - LIVE: only on production with the code switch, STRIPE_LIVE_CHECKOUT_ENABLED,
 *   live keys and a webhook secret (src/commerce/checkout/live.ts). Not approved yet.
 */
export async function startCheckout(lines: { variantId: string; quantity: number }[]): Promise<CheckoutResult> {
  // Live only when every live lock is open (which also means this is production).
  if (liveCheckoutEnabled()) return startLiveCheckout(lines);
  if (testCheckoutEnabled()) return startTestCheckout(lines);
  try {
    getCheckoutProvider();
    return { ok: false, error: "Checkout isn't open yet." };
  } catch (err) {
    if (!(err instanceof CheckoutDisabledError)) console.error("[checkout] unexpected:", err instanceof Error ? err.name : "unknown");
    return { ok: false, error: "Checkout isn't open yet." };
  }
}
