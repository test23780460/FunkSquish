import type { ProductStatus } from "@/commerce/types";
import { isPurchasable } from "@/commerce/catalog";
import { features } from "@/lib/features";
import { LockIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

/**
 * Add-to-cart slot. ALWAYS disabled during pre-launch.
 *
 * At launch, replace the disabled <button> with the payment provider's
 * add-to-cart / checkout action (e.g. Shopify cart or Stripe Checkout).
 * The size and position stay the same, so no redesign is needed.
 */
export function PurchaseButton({
  status,
  size = "sm",
  className,
}: {
  status: ProductStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const launchReady = features.commerce && isPurchasable(status);
  const label =
    status === "sold-out" ? "Sold out" : launchReady ? "Add to cart (coming soon)" : "Not for sale yet";

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={cn(
        "relative z-10 inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-sky-300 bg-ice font-display font-semibold text-ink-soft",
        size === "sm" ? "min-h-10 w-full whitespace-nowrap px-2 text-[0.8rem] sm:min-h-11 sm:text-sm" : "min-h-14 w-full px-6 text-lg",
        className,
      )}
    >
      <LockIcon className={size === "sm" ? "hidden size-3.5 min-[400px]:block" : "size-5"} />
      {label}
    </button>
  );
}
