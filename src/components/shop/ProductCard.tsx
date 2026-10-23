import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/commerce/types";
import { getCategory } from "@/commerce/categories";
import { availabilityLabel, canPurchase, formatMoney, getAvailability, startingPrice } from "@/commerce/availability";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { Badge } from "@/components/ui/Primitives";
import { PurchaseButton } from "./PurchaseButton";
import { themeClasses } from "@/components/theme";
import { cn } from "@/lib/cn";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const category = getCategory(product.category);
  const theme = category ? themeClasses[category.theme] : themeClasses.berry;
  const first = product.variants[0];
  const price = startingPrice(product);
  const availability = getAvailability(product);
  const soldOut = availability === "sold-out";
  const image = product.media.find((m) => m.type === "image");
  const sellable = product.variants.some((v) => canPurchase(product, v));
  const badgeTone = availability === "preview" ? "lemon" : availability === "in-stock" || availability === "low-stock" ? "mint" : "white";

  return (
    <article className="group squishy relative flex h-full flex-col rounded-[1.6rem] bg-white p-2 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200/80 sm:rounded-[2rem] sm:p-2.5">
      {/* media */}
      <div className={cn("relative grid aspect-square place-items-center overflow-hidden rounded-[1.25rem] sm:rounded-[1.6rem]", theme.soft)}>
        <div aria-hidden="true" className="absolute inset-0 dots opacity-40" />
        <div aria-hidden="true" className="absolute size-[70%] rounded-full bg-white/70" />
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
            preload={priority}
            className={cn("object-cover", soldOut && "grayscale")}
          />
        ) : (
          <ProductArt
            kind={product.art}
            palette={first.palette}
            title={`Illustration of the ${product.name}${product.publication === "preview" ? " sample design" : ""}`}
            className="relative h-[66%] w-auto drop-shadow-[0_14px_14px_rgba(19,53,122,0.2)] transition-transform duration-500 ease-squish group-hover:-rotate-6 group-hover:scale-110"
          />
        )}
        <Badge tone={badgeTone} className="absolute left-2 top-2 px-2 text-[0.7rem] sm:left-3 sm:top-3 sm:px-3 sm:text-xs">
          {availabilityLabel[availability]}
        </Badge>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-2.5 sm:pb-2 sm:pt-4">
        <p className={cn("font-display text-[0.68rem] font-semibold uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.14em]", theme.text)}>{category?.name}</p>
        <h3 className="mt-1 font-display text-[1.05rem] font-bold leading-tight text-ink sm:text-xl">
          <Link
            href={`/shop/${product.slug}`}
            prefetch={true}
            className="rounded-md after:absolute after:inset-0 after:rounded-[2rem] after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-royal"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1.5 hidden flex-1 text-[0.97rem] leading-relaxed text-ink-soft sm:block">{product.shortDescription}</p>
        <div className="flex-1 sm:hidden" />

        {/* variant swatches */}
        <div className="mt-3 flex items-center gap-1.5" aria-label={`${product.variants.length} color options`}>
          {product.variants.map((v) => (
            <span
              key={v.id}
              title={v.name}
              className="size-4 rounded-full ring-2 ring-white sm:size-5 shadow-[0_0_0_1.5px_rgba(19,53,122,0.25)]"
              style={{ backgroundColor: v.swatch }}
            />
          ))}
          <span className="sr-only">{product.variants.map((v) => v.name).join(", ")}</span>
        </div>

        <div className="mt-3 flex flex-col items-stretch gap-2.5 sm:mt-4">
          <p className="font-display text-base font-bold text-ink sm:text-lg">
            {price ? (product.variants.length > 1 ? `From ${formatMoney(price)}` : formatMoney(price)) : "Price TBA"}
          </p>
          {sellable && product.variants.length > 1 ? (
            <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-royal px-3 font-display text-sm font-semibold text-white shadow-[0_4px_0_var(--color-navy)]">
              Choose a color
            </span>
          ) : (
            <PurchaseButton product={product} variant={product.variants[0]} />
          )}
        </div>
      </div>
    </article>
  );
}
