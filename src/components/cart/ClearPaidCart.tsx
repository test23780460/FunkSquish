"use client";

import { useEffect } from "react";
import { clearCartAfterPaidCheckout } from "./Cart";
import { CART_STORAGE_KEY, TEST_CART_STORAGE_KEY } from "./cart-checkout";

/**
 * Rendered by the checkout result pages ONLY when the server re-fetched the
 * session from Stripe and it is paid. Removes the paid items from this
 * browser's cart (nothing happens if this browser didn't start that checkout).
 * Renders nothing.
 */
export function ClearPaidCart({ checkoutId, mode }: { checkoutId: string; mode: "test" | "live" }) {
  useEffect(() => {
    if (checkoutId) clearCartAfterPaidCheckout(mode === "test" ? TEST_CART_STORAGE_KEY : CART_STORAGE_KEY, checkoutId);
  }, [checkoutId, mode]);
  return null;
}
