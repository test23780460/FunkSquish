"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Availability, Product } from "@/commerce/types";
import { availabilityLabel, canPurchase, formatMoney, getAvailability, showCompareAt } from "@/commerce/availability";
import { generalCare, CPSC_SQUISHY_ALERT_URL } from "@/content/product-care";
import { ProductGallery } from "./ProductGallery";
import { PurchaseButton } from "./PurchaseButton";
import { CheckIcon, ChevronDownIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

const TBC = "To be confirmed";

const availabilityStyle: Record<Availability, { dot: string; detail: string }> = {
  preview: { dot: "bg-lemon", detail: "This is an illustrated sample design. It isn't real inventory and can't be bought." },
  "coming-soon": { dot: "bg-sky", detail: "Not available to order yet. Follow us on TikTok for launch news." },
  "in-stock": { dot: "bg-mint", detail: "Ready to order." },
  "low-stock": { dot: "bg-peach", detail: "Only a few left." },
  "sold-out": { dot: "bg-ink-soft", detail: "This one is sold out right now." },
  unavailable: { dot: "bg-ink-soft", detail: "This product isn't available." },
};

/**
 * Product gallery + color picker + buy box + detail sections.
 * Variant selection works today; quantity and purchase stay disabled until
 * every launch gate is open (see PurchaseButton / canPurchase).
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
  const availability = getAvailability(product, variant);
  const live = canPurchase(product, variant);
  const buyBox = useRef<HTMLDivElement>(null);
  const [buyBoxVisible, setBuyBoxVisible] = useState(true);

  // Show the mobile sticky bar only when the main buy box is scrolled away.
  useEffect(() => {
    const el = buyBox.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setBuyBoxVisible(entry.isIntersecting), { rootMargin: "0px 0px -80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dims = variant.dimensions;
  const specs: [string, string][] = [
    ["Material", product.specs.material ?? TBC],
    ["Filling", product.specs.fill ?? TBC],
    ["Texture", product.specs.texture ?? TBC],
    ["Size", product.specs.sizeDescription ?? TBC],
    ["Weight", variant.weightGrams ? `${variant.weightGrams} g` : TBC],
    ["Package size", dims ? `${dims.lengthCm} × ${dims.widthCm} × ${dims.heightCm} cm` : TBC],
    ["SKU", product.publication === "preview" ? "Sample — no SKU yet" : variant.sku],
  ];
  const safety = product.safety;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <ProductGallery product={product} variant={variant} themeSoft={themeSoft} />

      <div>
        {header}

        <fieldset className="mt-7">
          <legend className="font-display text-lg font-bold text-ink">
            Color: <span className="font-semibold text-royal">{variant.name}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {product.variants.map((v) => {
              const selected = v.id === variant.id;
              const vAvail = getAvailability(product, v);
              return (
                <label
                  key={v.id}
                  className={cn(
                    "relative inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 font-display font-semibold transition-all duration-200 ease-squish has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal",
                    selected ? "bg-ice text-ink ring-2 ring-inset ring-royal" : "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice-50",
                  )}
                >
                  <input type="radio" name="variant" value={v.id} checked={selected} onChange={() => setVariantId(v.id)} className="sr-only" />
                  <span
                    aria-hidden="true"
                    className="grid size-9 place-items-center rounded-full ring-2 ring-white shadow-[0_0_0_1.5px_rgba(19,53,122,0.25)]"
                    style={{ backgroundColor: v.swatch }}
                  >
                    {selected && <CheckIcon className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />}
                  </span>
                  {v.name}
                  {vAvail === "sold-out" && <span className="text-xs font-semibold text-ink-soft">(sold out)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Buy box */}
        <div ref={buyBox} className="mt-7 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft">Price</p>
              <p className="font-display text-3xl font-bold text-ink">
                {formatMoney(variant.price)}
                {showCompareAt(variant) && (
                  <span className="ml-2 align-middle text-lg font-semibold text-ink-soft line-through">
                    <span className="sr-only">was </span>
                    {formatMoney(variant.compareAtPrice)}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <label htmlFor="qty" className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Qty
              </label>
              <select
                id="qty"
                disabled={!live}
                className="mt-1 block min-h-11 w-20 appearance-none rounded-full bg-ice-50 text-center font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 disabled:cursor-not-allowed disabled:text-ink-soft"
                defaultValue="1"
              >
                <option value="1">1</option>
              </select>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-ice-50 px-3.5 py-2.5 text-[0.95rem] text-ink" role="status">
            <span aria-hidden="true" className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", availabilityStyle[availability].dot)} />
            <span>
              <strong className="font-display">{availabilityLabel[availability]}.</strong> {availabilityStyle[availability].detail}
            </span>
          </p>

          <PurchaseButton product={product} variant={variant} size="lg" className="mt-4" />
          <p className="mt-3 text-center text-sm text-ink-soft">
            {live ? "Payment happens on our secure checkout provider." : "Checkout will open after launch through a secure payment provider."}
          </p>
        </div>

        {/* Detail sections */}
        <div className="mt-6 space-y-3">
          <Section title="Specifications" defaultOpen>
            <dl className="divide-y divide-sky-200/70">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="font-semibold text-ink">{k}</dt>
                  <dd className={cn("text-right", v === TBC ? "text-ink-soft italic" : "text-ink")}>{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Age guidance & safety">
            <dl className="divide-y divide-sky-200/70">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="font-semibold text-ink">Age grading</dt>
                <dd className={cn("text-right", safety.ageGrade ? "text-ink" : "italic text-ink-soft")}>{safety.ageGrade ?? TBC}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="font-semibold text-ink">Manufacturer / importer</dt>
                <dd className={cn("text-right", safety.manufacturerOrImporter ? "text-ink" : "italic text-ink-soft")}>{safety.manufacturerOrImporter ?? TBC}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="font-semibold text-ink">Country of origin</dt>
                <dd className={cn("text-right", safety.countryOfOrigin ? "text-ink" : "italic text-ink-soft")}>{safety.countryOfOrigin ?? TBC}</dd>
              </div>
            </dl>
            {safety.warnings.length > 0 ? (
              <div className="mt-3 rounded-2xl border-2 border-ink bg-white p-3.5" role="note">
                <p className="font-display font-bold uppercase tracking-wide text-ink">Warning</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                  {safety.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-[0.95rem] italic text-ink-soft">
                Product warnings will be listed here exactly as they appear on the product&apos;s label.
              </p>
            )}
          </Section>

          <Section title="Care">
            <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
              {[...safety.careInstructions, ...generalCare].map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-soft">
              General squishy safety tips follow the{" "}
              <a href={CPSC_SQUISHY_ALERT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-royal underline underline-offset-2">
                U.S. CPSC squishy toy safety alert
              </a>
              . More on our <Link href="/product-care" className="font-semibold text-royal underline underline-offset-2">Product care &amp; safety</Link> page.
            </p>
          </Section>

          <Section title="Shipping & returns">
            <p className="text-ink-soft">
              Shipping options, costs, and our returns policy will be confirmed before the shop opens. Shipping and tax will be
              calculated at checkout.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/shipping" className="font-semibold text-royal underline underline-offset-2">Shipping information</Link>
              <Link href="/returns" className="font-semibold text-royal underline underline-offset-2">Returns &amp; exchanges</Link>
            </p>
          </Section>
        </div>

        {footer}
      </div>

      {/* Mobile sticky purchase bar */}
      <div
        inert={buyBoxVisible}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-sky-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-12px_rgba(19,53,122,0.35)] backdrop-blur transition-transform duration-300 lg:hidden",
          buyBoxVisible ? "pointer-events-none translate-y-full" : "translate-y-0",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-semibold text-ink">
              {product.name} · {variant.name}
            </p>
            <p className="text-sm text-ink-soft">
              {formatMoney(variant.price)} · {availabilityLabel[availability]}
            </p>
          </div>
          <div className="w-40 shrink-0">
            <PurchaseButton product={product} variant={variant} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-[1.75rem] bg-white ring-1 ring-inset ring-sky-200 open:shadow-[var(--shadow-card)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.75rem] px-5 font-display text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="size-5 text-royal transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
