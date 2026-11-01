import Link from "next/link";
import { categories } from "@/commerce/categories";
import { isPreviewCatalog } from "@/commerce/catalog";
import { purchasingEnabled } from "@/lib/features";
import { Container, SectionHeading, Badge } from "@/components/ui/Primitives";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { ArrowRightIcon } from "@/components/icons/Icons";
import { themeClasses, themePalette } from "@/components/theme";
import { cn } from "@/lib/cn";

export function Collections() {
  return (
    <section id="collections" aria-labelledby="collections-title" className="relative bg-white py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Upcoming collections"
          title={<span id="collections-title">Four ways to squish</span>}
          lead={
            isPreviewCatalog
              ? "A sneak peek at the collections we're putting together. These are previews — nothing is for sale just yet."
              : `Four collections, each with its own kind of squish.${purchasingEnabled ? "" : " Ordering isn't open just yet."}`
          }
        />

        <ul className="mt-10 grid gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {categories.map((cat, i) => {
            const t = themeClasses[cat.theme];
            return (
              <li key={cat.slug} className="flex">
                <Link
                  href={`/shop?category=${cat.slug}`}
                  className={cn(
                    "group squishy relative flex w-full flex-row items-center gap-1 overflow-hidden rounded-[2rem] p-2.5 ring-1 ring-inset shadow-[var(--shadow-card)] sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-[var(--radius-blob)] sm:p-3",
                    t.soft,
                    t.ring,
                  )}
                >
                  {/* art stage */}
                  <div className="relative grid aspect-square w-28 shrink-0 place-items-center overflow-hidden rounded-[1.5rem] bg-white/70 min-[400px]:w-32 sm:aspect-[5/4] sm:w-auto sm:rounded-[1.75rem]">
                    <div aria-hidden="true" className={cn("absolute size-[78%] rounded-full blur-[2px]", t.blob)} />
                    <div aria-hidden="true" className="absolute inset-0 dots opacity-50" />
                    <ProductArt
                      kind={cat.art}
                      palette={themePalette[cat.theme]}
                      mood={i % 2 === 0 ? "grin" : "happy"}
                      className="relative h-[72%] w-auto drop-shadow-[0_14px_14px_rgba(19,53,122,0.18)] transition-transform duration-500 ease-squish group-hover:-rotate-6 group-hover:scale-110"
                    />
                    <span className="absolute left-3 top-3 hidden sm:block">
                      <Badge tone="white" className="text-xs">
                        Preview
                      </Badge>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col px-2 py-1 sm:pb-2 sm:pt-4">
                    <p className={cn("font-display text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm", t.text)}>
                      {cat.tagline}
                    </p>
                    <h3 className="mt-0.5 font-display text-xl font-bold leading-tight text-ink sm:mt-1 sm:text-2xl">{cat.name}</h3>
                    <p className="mt-2 hidden flex-1 leading-relaxed text-ink-soft sm:block">{cat.description}</p>
                    <span className="mt-2 inline-flex items-center gap-1.5 font-display text-[0.95rem] font-semibold text-royal sm:mt-4 sm:text-base">
                      {isPreviewCatalog ? "See sample designs" : "Shop the collection"}
                      <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
