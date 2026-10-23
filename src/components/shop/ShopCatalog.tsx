"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CategorySlug, Product } from "@/commerce/types";
import { categories, isCategorySlug } from "@/commerce/categories";
import { startingPrice } from "@/commerce/catalog";
import { ProductCard } from "./ProductCard";
import { Mascot } from "@/components/illustrations/Mascot";
import { ChevronDownIcon, SearchIcon, CloseIcon } from "@/components/icons/Icons";
import { themeClasses } from "@/components/theme";
import { cn } from "@/lib/cn";

type SortKey = "featured" | "newest" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

const SORTS: { key: SortKey; label: string; needsPrice?: boolean }[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "name-asc", label: "Name: A to Z" },
  { key: "name-desc", label: "Name: Z to A" },
  { key: "price-asc", label: "Price: low to high", needsPrice: true },
  { key: "price-desc", label: "Price: high to low", needsPrice: true },
];

type Filter = CategorySlug | "all";

/** Reads ?category= from the URL. Rendered inside <Suspense>. */
export function ShopCatalogFromUrl({ products }: { products: Product[] }) {
  const params = useSearchParams();
  const raw = params.get("category");
  const category: Filter = isCategorySlug(raw) ? raw : "all";
  return <ShopCatalog products={products} category={category} />;
}

export function ShopCatalog({ products, category = "all" }: { products: Product[]; category?: Filter }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");

  const hasPrices = products.some((p) => startingPrice(p) !== null);
  const sorts = SORTS.filter((s) => !s.needsPrice || hasPrices);

  const setCategory = (next: Filter) => {
    // Shallow URL update (no server round-trip). Next.js syncs useSearchParams with it.
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    window.history.replaceState(null, "", url);
  };

  const q = query.trim().toLowerCase();
  const price = (p: Product) => startingPrice(p)?.amount ?? Number.POSITIVE_INFINITY;
  const visible = products
    .filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      const haystack = [p.name, p.shortDescription, ...p.tags, ...p.variants.map((v) => v.name)].join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return price(a) - price(b);
        case "price-desc":
          return price(b) - price(a);
        default:
          return a.featuredRank - b.featuredRank;
      }
    });

  const filterButtons: { value: Filter; label: string; dot: string }[] = [
    { value: "all", label: "All", dot: "bg-sky" },
    ...categories.map((c) => ({ value: c.slug as Filter, label: c.name, dot: themeClasses[c.theme].solid })),
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="rounded-[2rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <label htmlFor="shop-search" className="sr-only">
              Search the preview catalog
            </label>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
            <input
              id="shop-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search squishies…"
              className="min-h-12 w-full rounded-full bg-ice-50 pl-12 pr-11 text-base text-ink ring-2 ring-inset ring-sky-200 placeholder:text-ink-soft focus:outline-none focus:ring-royal [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-ice"
              >
                <CloseIcon className="size-4" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>

          <div className="relative md:w-60">
            <label htmlFor="shop-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="shop-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="min-h-12 w-full cursor-pointer appearance-none rounded-full bg-ice-50 pl-5 pr-11 font-display font-semibold text-ink ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal"
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter by collection"
          className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:px-4 [&::-webkit-scrollbar]:hidden"
        >
          {filterButtons.map((f) => {
            const active = category === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(f.value)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-display font-semibold transition-all duration-200 ease-squish",
                  active
                    ? "bg-royal text-white shadow-[0_4px_0_var(--color-navy)]"
                    : "bg-ice-50 text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice",
                )}
              >
                <span aria-hidden="true" className={cn("size-2.5 rounded-full ring-2", f.dot, active ? "ring-white/80" : "ring-white")} />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 px-1 font-display font-semibold text-ink-soft" aria-live="polite">
        {visible.length} {visible.length === 1 ? "sample" : "samples"} shown
      </p>

      {visible.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-[2rem] bg-white px-6 py-12 text-center ring-1 ring-inset ring-sky-200">
          <Mascot className="w-28" mood="sleepy" />
          <p className="mt-4 font-display text-2xl font-bold text-ink">No squishies match that</p>
          <p className="mt-1 text-ink-soft">Try a different word or collection.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-5 rounded-full bg-royal px-5 py-2.5 font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]"
          >
            Show all samples
          </button>
        </div>
      )}
    </div>
  );
}
