"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { Product } from "@/commerce/types";
import { formatMoney } from "@/commerce/catalog";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { Bubble } from "@/components/decor/Decor";
import { CheckIcon } from "@/components/icons/Icons";
import { PurchaseButton } from "./PurchaseButton";
import { cn } from "@/lib/cn";

/**
 * Product gallery + variant picker + buy box.
 * Variant selection already works (it recolors the illustration);
 * quantity and purchase stay disabled until launch.
 */
export function ProductShowcase({
  product,
  themeSoft,
  header,
  footer,
}: {
  product: Product;
  themeSoft: string;
  header: ReactNode;
  footer?: ReactNode;
}) {
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const image = product.images[0];

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      {/* Gallery */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className={cn("relative grid aspect-square place-items-center overflow-hidden rounded-[2.5rem] ring-1 ring-inset ring-sky-200", themeSoft)}>
          <div aria-hidden="true" className="absolute inset-0 dots opacity-50" />
          <div aria-hidden="true" className="absolute size-[72%] rounded-full bg-white/75" />
          <Bubble size={36} className="left-[10%] top-[12%]" />
          <Bubble size={20} className="bottom-[14%] right-[12%]" delay={1.5} />
          {image ? (
            <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" preload />
          ) : (
            <ProductArt
              key={variant.id}
              kind={product.art}
              palette={variant.palette}
              mood="grin"
              title={`Illustration of the ${product.name} sample design in ${variant.name}`}
              className="relative h-[66%] w-auto animate-rise drop-shadow-[0_24px_24px_rgba(19,53,122,0.22)]"
            />
          )}
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 font-display text-xs font-semibold text-ink-soft ring-1 ring-inset ring-sky-200 sm:right-4 sm:top-4">
            Illustration, not a photo
          </span>
        </div>
      </div>

      {/* Details */}
      <div>
        {header}

        <fieldset className="mt-7">
          <legend className="font-display text-lg font-bold text-ink">
            Color: <span className="font-semibold text-royal">{variant.name}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {product.variants.map((v) => {
              const selected = v.id === variant.id;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "relative inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 font-display font-semibold transition-all duration-200 ease-squish has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal",
                    selected ? "bg-ice text-ink ring-2 ring-inset ring-royal" : "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice-50",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={selected}
                    onChange={() => setVariantId(v.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-9 place-items-center rounded-full ring-2 ring-white shadow-[0_0_0_1.5px_rgba(19,53,122,0.25)]"
                    style={{ backgroundColor: v.swatch }}
                  >
                    {selected && <CheckIcon className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />}
                  </span>
                  {v.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-7 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft">Price</p>
              <p className="font-display text-3xl font-bold text-ink">{formatMoney(variant.price)}</p>
            </div>
            <div className="text-right">
              <label htmlFor="qty" className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Qty
              </label>
              <select
                id="qty"
                disabled
                className="mt-1 block min-h-11 w-20 cursor-not-allowed appearance-none rounded-full bg-ice-50 text-center font-display font-semibold text-ink-soft ring-1 ring-inset ring-sky-200"
                defaultValue="1"
              >
                <option value="1">1</option>
              </select>
            </div>
          </div>
          <PurchaseButton status={product.status} size="lg" className="mt-5" />
          <p className="mt-3 text-center text-sm text-ink-soft">
            Checkout will open after launch through a secure payment provider.
          </p>
        </div>

        {footer}
      </div>
    </div>
  );
}
