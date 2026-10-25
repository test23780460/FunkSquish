"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductSummary } from "@/commerce/summary";
import type { CategorySlug } from "@/commerce/types";
import { categories, getCategory } from "@/commerce/categories";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { Mascot } from "@/components/illustrations/Mascot";
import { CloseIcon, HeartIcon, LockIcon, SparklesIcon } from "@/components/icons/Icons";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Primitives";
import { themeClasses } from "@/components/theme";
import { trackEvent } from "@/components/analytics/track";
import { useWishlist } from "@/components/wishlist/useWishlist";
import { createLocalStore, useHydrated, useLocalStore } from "@/lib/local-store";
import {
  BOX_SIZES,
  NAME_MAX,
  RIBBONS,
  addItem,
  cleanName,
  decodeBox,
  emptyBox,
  encodeBox,
  removeAt,
  sanitizeBox,
  setSize,
  slotsFor,
  surpriseFill,
  type BoxDraft,
} from "@/lib/squish-box";
import { cn } from "@/lib/cn";

const EMPTY = emptyBox();
const boxStore = createLocalStore<BoxDraft>(
  "funksquish-box-v1",
  (raw) => {
    try {
      return sanitizeBox(JSON.parse(raw ?? "null"));
    } catch {
      return EMPTY;
    }
  },
  EMPTY,
);

type Entry = { product: ProductSummary; variant: ProductSummary["variants"][number] };

/** Reads a shared box from the URL. Rendered inside <Suspense>. */
export function SquishBoxFromUrl({ products }: { products: ProductSummary[] }) {
  const params = useSearchParams();
  const known = useMemo(() => new Set(products.flatMap((p) => p.variants.map((v) => v.id))), [products]);
  const shared = decodeBox(new URLSearchParams(params.toString()), known);
  return <SquishBoxBuilder products={products} shared={shared} />;
}

export function SquishBoxBuilder({ products, shared = null }: { products: ProductSummary[]; shared?: BoxDraft | null }) {
  const mine = useLocalStore(boxStore);
  const hydrated = useHydrated();
  const router = useRouter();
  const wishlist = useWishlist();
  const [filter, setFilter] = useState<CategorySlug | "all">("all");
  const [announce, setAnnounce] = useState("");
  const [lastAdded, setLastAdded] = useState(-1);

  const viewingShared = !!shared;
  const box = shared ?? mine;
  const slots = slotsFor(box.size);
  const ribbon = RIBBONS.find((r) => r.id === box.ribbon) ?? RIBBONS[0];

  const byVariant = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const p of products) for (const v of p.variants) m.set(v.id, { product: p, variant: v });
    return m;
  }, [products]);
  const entries = box.items.flatMap((id) => byVariant.get(id) ?? []);
  const update = (next: BoxDraft) => boxStore.set(next);

  const add = (e: Entry) => {
    if (mine.items.length >= slots) return setAnnounce("Your box is full. Remove one or pick a bigger box.");
    update(addItem(mine, e.variant.id));
    setLastAdded(mine.items.length);
    setAnnounce(`Added ${e.product.name}, ${e.variant.name}. ${mine.items.length + 1} of ${slots} slots filled.`);
    if (mine.items.length === 0) trackEvent("box-start");
  };

  const share = async () => {
    const url = `${window.location.origin}/squish-box?${encodeBox(box)}`;
    try {
      if (navigator.share) return void (await navigator.share({ title: "My FunkSquish Squish Box", url }));
      await navigator.clipboard.writeText(url);
      setAnnounce("Box link copied! It lists the squishies and your box name — nothing else.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setAnnounce(`Copy this link: ${url}`);
    }
  };

  const visible = products.filter((p) => filter === "all" || p.category === filter);
  const allVariantIds = products.flatMap((p) => p.variants.map((v) => v.id));
  const full = box.items.length >= slots;
  const cols = slots === 8 ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
      {/* ---------------- The box ---------------- */}
      <div id="your-box" className="lg:sticky lg:top-28">
        {viewingShared && (
          <div className="mb-4 rounded-[1.75rem] bg-lemon-soft p-4 ring-2 ring-inset ring-lemon">
            <p className="font-display text-lg font-bold text-ink">You&apos;re looking at a shared box</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClasses({})}
                onClick={() => {
                  update(box);
                  router.replace("/squish-box", { scroll: false });
                }}
              >
                Make it my box
              </button>
              <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => router.replace("/squish-box", { scroll: false })}>
                Back to my box
              </button>
            </div>
            {hydrated && mine.items.length > 0 && <p className="mt-2 text-sm text-ink-soft">“Make it my box” replaces the box you were building.</p>}
          </div>
        )}

        <div className="relative rounded-[2.5rem] bg-[linear-gradient(170deg,#ffffff_0%,#e4f3ff_100%)] p-3 shadow-[var(--shadow-float)] ring-1 ring-inset ring-sky-200 sm:p-4">
          {/* lid */}
          <div className="relative overflow-hidden rounded-[2rem] bg-royal px-5 py-4 text-white shadow-[0_6px_0_var(--color-navy)]">
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-6 -translate-x-1/2" style={{ backgroundColor: ribbon.color }} />
            <span aria-hidden="true" className="absolute inset-0 dots opacity-25" />
            <div className="relative flex items-center justify-between gap-3">
              <p className="min-w-0 truncate rounded-full bg-white/95 px-3 py-1 font-display text-lg font-bold text-ink">
                {box.name || "My Squish Box"}
              </p>
              <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-display text-sm font-semibold ring-1 ring-inset ring-white/30">
                {box.items.length}/{slots}
              </span>
            </div>
          </div>

          <ul aria-label={`Box contents, ${box.items.length} of ${slots} filled`} className={cn("mt-4 grid gap-2.5 sm:gap-3", cols)}>
            {Array.from({ length: slots }, (_, i) => {
              const e = entries[i];
              if (!e)
                return (
                  <li
                    key={`empty-${i}`}
                    className="grid aspect-square place-items-center rounded-[1.4rem] border-2 border-dashed border-sky-300 bg-white/60 font-display text-2xl font-bold text-sky-300"
                  >
                    <span aria-hidden="true">+</span>
                    <span className="sr-only">Empty slot {i + 1}</span>
                  </li>
                );
              const theme = themeClasses[getCategory(e.product.category)?.theme ?? "berry"];
              return (
                <li
                  key={`${e.variant.id}-${i}`}
                  className={cn("group relative grid aspect-square place-items-center rounded-[1.4rem] ring-1 ring-inset ring-sky-200", theme.soft, i === lastAdded && "animate-drop-in")}
                >
                  <ProductArt kind={e.product.art} palette={e.variant.palette} className="h-[72%] w-auto drop-shadow-[0_8px_8px_rgba(19,53,122,0.2)]" />
                  <span className="sr-only">
                    {e.product.name}, {e.variant.name}
                    {e.product.preview ? " (sample design)" : ""}
                  </span>
                  {!viewingShared && (
                    <button
                      type="button"
                      onClick={() => {
                        update(removeAt(mine, i));
                        setLastAdded(-1);
                        setAnnounce(`Removed ${e.product.name}, ${e.variant.name}.`);
                      }}
                      className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-white/95 text-ink ring-1 ring-inset ring-sky-200 hover:text-[#d62f6d]"
                    >
                      <CloseIcon className="size-3.5" />
                      <span className="sr-only">
                        Remove {e.product.name}, {e.variant.name}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <p role="status" aria-live="polite" className="mt-3 min-h-6 break-words px-1 text-center font-display font-semibold text-royal">
            {announce}
          </p>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {!viewingShared && (
              <>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => {
                    update(surpriseFill(mine, allVariantIds));
                    setLastAdded(-1);
                    setAnnounce("Surprise! We filled the empty slots.");
                  }}
                  className={buttonClasses({ variant: "secondary", className: "disabled:opacity-50" })}
                >
                  <SparklesIcon className="size-5" />
                  Surprise me
                </button>
                {box.items.length > 0 && (
                  <button type="button" onClick={() => { update({ ...mine, items: [] }); setAnnounce("Box emptied."); }} className={buttonClasses({ variant: "ghost" })}>
                    Empty box
                  </button>
                )}
              </>
            )}
            {box.items.length > 0 && (
              <>
                {!viewingShared && (
                  <button type="button" onClick={share} className={buttonClasses({ variant: "secondary" })}>
                    Share box
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const slugs = [...new Set(entries.map((e) => e.product.slug))];
                    wishlist.merge(slugs);
                    setAnnounce(`Saved ${slugs.length} ${slugs.length === 1 ? "squishy" : "squishies"} to your wishlist.`);
                  }}
                  className={buttonClasses({ variant: "secondary" })}
                >
                  <HeartIcon className="size-5" />
                  Save to wishlist
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[1.75rem] bg-white p-4 ring-1 ring-inset ring-sky-200">
          <button type="button" disabled aria-disabled="true" className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border-2 border-dashed border-sky-300 bg-ice font-display text-lg font-semibold text-ink-soft">
            <LockIcon className="size-5" />
            Box ordering isn&apos;t open yet
          </button>
          <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
            This is a preview builder. Squish Boxes can&apos;t be ordered yet, and pricing — including any box savings — will
            only be announced once real products and prices are confirmed. Your box is saved on this device.
          </p>
        </div>
      </div>

      {/* ---------------- Controls + picker ---------------- */}
      <div className={cn("space-y-6", viewingShared && "pointer-events-none opacity-50")} inert={viewingShared}>
        <fieldset className="rounded-[2rem] bg-white p-4 ring-1 ring-inset ring-sky-200 sm:p-5">
          <legend className="sr-only">Box size</legend>
          <p aria-hidden="true" className="font-display text-lg font-bold text-ink">1. Pick a size</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {BOX_SIZES.map((s) => {
              const on = box.size === s.id;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-2xl px-2 py-3 text-center transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-royal",
                    on ? "bg-ice ring-2 ring-inset ring-royal" : "bg-ice-50 ring-1 ring-inset ring-sky-200 hover:bg-ice",
                  )}
                >
                  <input
                    type="radio"
                    name="box-size"
                    value={s.id}
                    checked={on}
                    onChange={() => {
                      const dropped = Math.max(0, mine.items.length - s.slots);
                      update(setSize(mine, s.id));
                      setAnnounce(dropped ? `${s.name}: ${dropped} ${dropped === 1 ? "pick" : "picks"} didn't fit and were removed.` : `${s.name} selected.`);
                    }}
                    className="sr-only"
                  />
                  <span className="font-display text-2xl font-bold text-ink">{s.slots}</span>
                  <span className="font-display text-sm font-semibold text-ink">{s.name}</span>
                  <span className="hidden text-xs text-ink-soft sm:block">{s.note}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 rounded-[2rem] bg-white p-4 ring-1 ring-inset ring-sky-200 sm:grid-cols-2 sm:p-5">
          <fieldset>
            <legend className="font-display text-lg font-bold text-ink">2. Ribbon</legend>
            <div className="mt-3 flex gap-2">
              {RIBBONS.map((r) => (
                <label key={r.id} className="cursor-pointer rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal">
                  <input type="radio" name="ribbon" value={r.id} checked={box.ribbon === r.id} onChange={() => update({ ...mine, ribbon: r.id })} className="sr-only" />
                  <span
                    aria-hidden="true"
                    className={cn("block size-11 rounded-full ring-white transition-transform", box.ribbon === r.id ? "scale-110 ring-4 shadow-[0_0_0_2px_var(--color-royal)]" : "ring-2 shadow-[0_0_0_1.5px_rgba(19,53,122,0.25)]")}
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="sr-only">{r.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="box-name" className="font-display text-lg font-bold text-ink">
              3. Name your box
            </label>
            <input
              id="box-name"
              type="text"
              value={box.name}
              maxLength={NAME_MAX}
              onChange={(e) => update({ ...mine, name: cleanName(e.target.value) })}
              placeholder="e.g. Crunch Party"
              autoComplete="off"
              className="mt-3 min-h-12 w-full rounded-full bg-ice-50 px-5 text-base text-ink ring-2 ring-inset ring-sky-200 placeholder:text-ink-soft focus:outline-none focus:ring-royal"
            />
            <p className="mt-1.5 px-2 text-xs text-ink-soft">Optional. Included if you share the box — skip personal details.</p>
          </div>
        </div>

        <section aria-labelledby="picker-title" className="rounded-[2rem] bg-white p-4 ring-1 ring-inset ring-sky-200 sm:p-5">
          <h2 id="picker-title" className="font-display text-lg font-bold text-ink">
            4. Fill it up
          </h2>
          <p className="text-sm text-ink-soft">Tap a color to drop it in. All of these are sample designs for now.</p>
          <div role="group" aria-label="Filter by collection" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
            {[{ slug: "all" as const, name: "All" }, ...categories].map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={filter === c.slug}
                onClick={() => setFilter(c.slug)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-4 font-display text-sm font-semibold transition-colors",
                  filter === c.slug ? "bg-royal text-white shadow-[0_3px_0_var(--color-navy)]" : "bg-ice-50 text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <ul className="mt-4 grid gap-2.5">
            {visible.map((p) => {
              const theme = themeClasses[getCategory(p.category)?.theme ?? "berry"];
              return (
                <li key={p.slug} className="flex items-center gap-3 rounded-[1.4rem] bg-ice-50 p-2 ring-1 ring-inset ring-sky-200">
                  <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl sm:size-20", theme.soft)}>
                    <ProductArt kind={p.art} palette={p.variants[0].palette} className="h-[74%] w-auto" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 font-display font-bold leading-tight text-ink">
                      <Link href={`/shop/${p.slug}`} className="hover:text-royal">{p.name}</Link>
                      {p.preview && <Badge tone="lemon" className="px-2 py-0 text-[0.65rem]">Sample</Badge>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          disabled={full}
                          onClick={() => add({ product: p, variant: v })}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200 transition-transform duration-200 ease-squish hover:-translate-y-0.5 hover:ring-royal disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden="true" className="size-6 rounded-full ring-2 ring-white shadow-[0_0_0_1.5px_rgba(19,53,122,0.25)]" style={{ backgroundColor: v.swatch }} />
                          <span className="sr-only">Add {p.name} in </span>
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {full && (
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-3 font-display font-semibold text-ink">
              <Mascot className="w-10" mood="happy" /> Box full! Remove one to swap, or pick a bigger box.
            </p>
          )}
        </section>
      </div>

      {/* Phone: quick jump back to the box while picking */}
      {!viewingShared && box.items.length > 0 && (
        <a
          href="#your-box"
          className="fixed bottom-4 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 font-display font-semibold text-white shadow-[var(--shadow-float)] lg:hidden"
        >
          View box · {box.items.length}/{slots}
        </a>
      )}
    </div>
  );
}
