import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { ProductSummary } from "@/commerce/summary";
import { availabilityLabel } from "@/commerce/availability";
import { getCategory } from "@/commerce/categories";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { Badge } from "@/components/ui/Primitives";
import { themeClasses } from "@/components/theme";
import { cn } from "@/lib/cn";

/**
 * Compact product tile for interactive pages (wishlist, quiz results, Squish Box).
 * Always shows the honest availability badge; preview concepts say so.
 */
export function MiniProductCard({
  product,
  variantId,
  action,
  footer,
  className,
}: {
  product: ProductSummary;
  variantId?: string;
  /** Top-right control (e.g. a wishlist heart or remove button). */
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const category = getCategory(product.category);
  const theme = category ? themeClasses[category.theme] : themeClasses.berry;
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const tone = product.preview ? "lemon" : product.availability === "in-stock" || product.availability === "low-stock" ? "mint" : "white";

  return (
    <article className={cn("group relative flex h-full flex-col rounded-[1.6rem] bg-white p-2 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200/80", className)}>
      <div className={cn("relative grid aspect-square place-items-center overflow-hidden rounded-[1.25rem]", theme.soft)}>
        <span aria-hidden="true" className="absolute inset-0 dots opacity-40" />
        <span aria-hidden="true" className="absolute size-[70%] rounded-full bg-white/70" />
        {product.image ? (
          <Image src={product.image.src} alt={product.image.alt} fill sizes="(min-width: 1024px) 20vw, 45vw" className="object-cover" />
        ) : (
          <ProductArt
            kind={product.art}
            palette={variant.palette}
            title={`Illustration of the ${product.name}${product.preview ? " sample design" : ""}`}
            className="relative h-[64%] w-auto drop-shadow-[0_12px_12px_rgba(19,53,122,0.2)] transition-transform duration-500 ease-squish group-hover:-rotate-6 group-hover:scale-110"
          />
        )}
        <Badge tone={tone} className="absolute left-2 top-2 px-2 text-[0.7rem]">
          {availabilityLabel[product.availability]}
        </Badge>
        {action && <div className="absolute right-2 top-2 z-10">{action}</div>}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <p className={cn("font-display text-[0.68rem] font-semibold uppercase tracking-[0.12em]", theme.text)}>{category?.name}</p>
        <h3 className="mt-0.5 font-display text-[1.05rem] font-bold leading-tight text-ink">
          <Link
            href={`/shop/${product.slug}`}
            className="rounded-md after:absolute after:inset-0 after:rounded-[1.6rem] after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-royal"
          >
            {product.name}
          </Link>
        </h3>
        {variantId && variant && <p className="mt-0.5 text-sm text-ink-soft">{variant.name}</p>}
        {footer && <div className="relative z-10 mt-auto pt-3">{footer}</div>}
      </div>
    </article>
  );
}
