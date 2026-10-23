"use client";

import type { Product, ProductVariant } from "@/commerce/types";
import { availabilityLabel, canPurchase, getAvailability } from "@/commerce/availability";
import { features } from "@/lib/features";
import { useCart } from "@/components/cart/Cart";
import { LockIcon, ArrowRightIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

/**
 * The one place a purchase can start. During pre-launch it is ALWAYS a
 * disabled button. It only becomes active when every gate is open:
 * `features.commerce`, a checkout mode, a published product with a price and
 * tracked stock (see `canPurchase`). Card data never touches this site.
 */
export function PurchaseButton({
  product,
  variant,
  size = "sm",
  className,
}: {
  product: Product;
  variant: ProductVariant;
  size?: "sm" | "lg";
  className?: string;
}) {
  const cart = useCart();
  const availability = getAvailability(product, variant);
  const sizing = size === "sm" ? "min-h-10 w-full whitespace-nowrap px-2 text-[0.8rem] sm:min-h-11 sm:text-sm" : "min-h-14 w-full px-6 text-lg";
  const live = canPurchase(product, variant);

  if (live && features.checkoutMode === "external-links" && variant.externalPurchaseUrl) {
    return (
      <a
        href={variant.externalPurchaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-umami-event="buy-external"
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full bg-royal font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]",
          sizing,
          className,
        )}
      >
        Buy now
        <ArrowRightIcon className="size-4" />
        <span className="sr-only"> (opens the store listing in a new tab)</span>
      </a>
    );
  }

  if (live && features.checkoutMode === "hosted-checkout" && cart) {
    return (
      <button
        type="button"
        onClick={() => cart.add({ variantId: variant.id, productName: product.name, variantName: variant.name, price: variant.price })}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full bg-royal font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)] active:translate-y-0.5",
          sizing,
          className,
        )}
      >
        Add to cart
      </button>
    );
  }

  const label =
    availability === "sold-out" ? "Sold out" : availability === "preview" ? "Not for sale yet" : availabilityLabel["coming-soon"];

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={cn(
        "relative z-10 inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-sky-300 bg-ice font-display font-semibold text-ink-soft",
        sizing,
        className,
      )}
    >
      <LockIcon className={size === "sm" ? "hidden size-3.5 min-[400px]:block" : "size-5"} />
      {label}
    </button>
  );
}
