"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductSummary } from "@/commerce/summary";
import { MiniProductCard } from "@/components/shop/MiniProductCard";
import { Mascot } from "@/components/illustrations/Mascot";
import { CloseIcon, HeartIcon, LockIcon, SparklesIcon } from "@/components/icons/Icons";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Primitives";
import { trackEvent } from "@/components/analytics/track";
import { SHARE_PARAM, decodeShareList, encodeShareList } from "@/lib/wishlist";
import { useHydrated } from "@/lib/local-store";
import { useWishlist } from "./useWishlist";

/** Reads `?list=` (a shared wishlist). Rendered inside <Suspense>. */
export function WishlistFromUrl({ products }: { products: ProductSummary[] }) {
  const params = useSearchParams();
  return <WishlistView products={products} shared={decodeShareList(params.get(SHARE_PARAM))} />;
}

export function WishlistView({ products, shared = [] }: { products: ProductSummary[]; shared?: string[] }) {
  const wishlist = useWishlist();
  const hydrated = useHydrated();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const sharedFound = shared.map((s) => bySlug.get(s)).filter((p): p is ProductSummary => !!p);
  const sharedMissing = shared.length - sharedFound.length;

  const mine = wishlist.items.flatMap((i) => {
    const p = bySlug.get(i.slug);
    return p ? [{ item: i, product: p }] : [];
  });
  const missing = wishlist.items.filter((i) => !bySlug.has(i.slug));
  const hasPreview = mine.some((m) => m.product.preview);

  const share = async () => {
    const url = new URL("/wishlist", window.location.origin);
    url.searchParams.set(SHARE_PARAM, encodeShareList(mine.map((m) => m.product.slug)));
    trackEvent("wishlist-share");
    try {
      if (navigator.share) {
        await navigator.share({ title: "My FunkSquish wishlist", url: url.toString() });
        setStatus("Shared!");
        return;
      }
      await navigator.clipboard.writeText(url.toString());
      setStatus("Link copied. It only lists the squishies — nothing about you.");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setStatus(`Copy this link to share: ${url.toString()}`);
    }
  };

  return (
    <div className="space-y-10">
      {shared.length > 0 && (
        <section aria-labelledby="shared-title" className="rounded-[2rem] bg-ice-50 p-4 ring-2 ring-inset ring-sky-200 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="shared-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Someone shared their wishlist
              </h2>
              <p className="mt-1 text-ink-soft">
                {sharedFound.length} {sharedFound.length === 1 ? "squishy" : "squishies"}
                {sharedMissing > 0 && ` (${sharedMissing} no longer listed)`}. Save any you like to your own list.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sharedFound.length > 0 && (
                <button
                  type="button"
                  className={buttonClasses({})}
                  onClick={() => {
                    const added = sharedFound.filter((p) => !wishlist.has(p.slug)).length;
                    wishlist.merge(sharedFound.map((p) => p.slug));
                    setStatus(added > 0 ? `Saved ${added} to your wishlist.` : "You already had all of these saved.");
                  }}
                >
                  <HeartIcon className="size-5" />
                  Save all to my wishlist
                </button>
              )}
              <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => router.replace("/wishlist", { scroll: false })}>
                Hide shared list
              </button>
            </div>
          </div>
          {sharedFound.length > 0 && (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sharedFound.map((p) => (
                <li key={p.slug}>
                  <MiniProductCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="mine-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="mine-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
              My wishlist
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-ink-soft">
              <LockIcon className="size-4" /> Saved on this device only — no account, nothing sent to us.
            </p>
          </div>
          {hydrated && mine.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={share} className={buttonClasses({})}>
                <SparklesIcon className="size-5" />
                Share my list
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmClear) return setConfirmClear(true);
                  wishlist.clear();
                  setConfirmClear(false);
                  setStatus("Wishlist cleared.");
                }}
                onBlur={() => setConfirmClear(false)}
                className={buttonClasses({ variant: "secondary" })}
              >
                {confirmClear ? "Tap again to clear" : "Clear list"}
              </button>
            </div>
          )}
        </div>

        <p role="status" aria-live="polite" className="mt-3 min-h-6 break-words font-display font-semibold text-royal">
          {status}
        </p>

        {!hydrated ? (
          <ul aria-hidden="true" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="aspect-[3/4] animate-pulse rounded-[1.6rem] bg-ice-50 ring-1 ring-inset ring-sky-200" />
            ))}
          </ul>
        ) : mine.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-[2rem] bg-white px-6 py-12 text-center ring-1 ring-inset ring-sky-200">
            <Mascot className="w-28" mood="sleepy" />
            <p className="mt-4 font-display text-2xl font-bold text-ink">Your wishlist is empty</p>
            <p className="mt-1 max-w-sm text-ink-soft">Tap the heart on any squishy to save it here.</p>
            <div className="mt-6 flex flex-col gap-3 min-[440px]:flex-row">
              <Link href="/shop" className={buttonClasses({})}>Browse the shop preview</Link>
              <Link href="/squish-lab" className={buttonClasses({ variant: "secondary" })}>Visit the Squish Lab</Link>
            </div>
          </div>
        ) : (
          <>
            {hasPreview && (
              <Notice title="Some of these are sample designs" icon={<SparklesIcon className="size-6" />} className="mt-2">
                Sample designs aren&apos;t real products and can&apos;t be bought. Keep them here to see which styles make it
                into a real collection.
              </Notice>
            )}
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {mine.map(({ item, product }) => (
                <li key={item.slug}>
                  <MiniProductCard
                    product={product}
                    variantId={item.variantId}
                    action={
                      <button
                        type="button"
                        onClick={() => wishlist.remove(item.slug)}
                        className="grid size-9 place-items-center rounded-full bg-white/95 text-ink ring-1 ring-inset ring-sky-200 hover:text-[#d62f6d]"
                      >
                        <CloseIcon className="size-4" />
                        <span className="sr-only">Remove {product.name} from wishlist</span>
                      </button>
                    }
                    footer={
                      product.availability === "sold-out" ? (
                        <p className="text-sm font-semibold text-ink-soft">Sold out right now.</p>
                      ) : product.priceLabel ? (
                        <p className="font-display font-bold text-ink">{product.priceLabel}</p>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {hydrated && missing.length > 0 && (
          <p className="mt-4 text-ink-soft">
            {missing.length} saved {missing.length === 1 ? "item is" : "items are"} no longer listed.{" "}
            <button
              type="button"
              onClick={() => missing.forEach((m) => wishlist.remove(m.slug))}
              className="font-semibold text-royal underline underline-offset-4"
            >
              Remove {missing.length === 1 ? "it" : "them"}
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
