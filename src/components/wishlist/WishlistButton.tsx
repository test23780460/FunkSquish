"use client";

import { useState } from "react";
import Link from "next/link";
import { HeartIcon, HeartOutlineIcon } from "@/components/icons/Icons";
import { trackEvent } from "@/components/analytics/track";
import { useHydrated } from "@/lib/local-store";
import { cn } from "@/lib/cn";
import { useWishlist } from "./useWishlist";

/** Heart toggle that saves a product to the browser-only wishlist. */
export function WishlistButton({
  slug,
  name,
  variantId,
  look = "icon",
  className,
}: {
  slug: string;
  name: string;
  variantId?: string;
  look?: "icon" | "pill";
  /** For the icon look, include a position (e.g. "absolute right-2 top-2"); defaults to relative. */
  className?: string;
}) {
  const wishlist = useWishlist();
  const hydrated = useHydrated();
  const saved = hydrated && wishlist.has(slug);
  const [popKey, setPopKey] = useState(0);

  const onClick = () => {
    if (!saved) {
      trackEvent("wishlist-add");
      setPopKey((k) => k + 1);
    }
    wishlist.toggle(slug, variantId);
  };

  const heart = saved ? (
    <HeartIcon key={popKey} className={cn("size-5", popKey > 0 && "animate-pop")} />
  ) : (
    <HeartOutlineIcon className="size-5" />
  );

  if (look === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          "inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-display font-semibold transition-colors duration-200",
          saved ? "bg-berry-soft text-[#b8215a] ring-2 ring-inset ring-berry/50" : "bg-white text-ink ring-2 ring-inset ring-sky-200 hover:ring-sky-300",
          className,
        )}
      >
        {heart}
        {saved ? "Saved to wishlist" : "Save to wishlist"}
        <span className="sr-only"> ({name})</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      className={cn(
        "z-10 grid size-10 place-items-center rounded-full bg-white/95 shadow-[0_3px_0_var(--color-sky-200)] ring-1 ring-inset ring-sky-200 transition-transform duration-200 ease-squish hover:scale-110 active:scale-95",
        saved ? "text-[#d62f6d]" : "text-ink",
        !/(absolute|fixed|sticky)/.test(className ?? "") && "relative",
        className,
      )}
    >
      {heart}
      <span className="sr-only">{saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}</span>
    </button>
  );
}

/** Header link to the wishlist with a live count. */
export function WishlistHeaderLink({ onNavigate }: { onNavigate?: () => void }) {
  const { count } = useWishlist();
  const hydrated = useHydrated();
  const n = hydrated ? count : 0;
  return (
    <Link
      href="/wishlist"
      onClick={onNavigate}
      className="relative inline-flex size-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-inset ring-sky-200 transition-transform duration-200 ease-squish hover:-translate-y-0.5 hover:text-[#d62f6d]"
    >
      {n > 0 ? <HeartIcon className="size-5" /> : <HeartOutlineIcon className="size-5" />}
      <span className="sr-only">Wishlist{n > 0 ? `, ${n} saved` : ""}</span>
      {n > 0 && (
        <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-berry px-1 font-display text-xs font-bold text-ink ring-2 ring-white">
          {n}
        </span>
      )}
    </Link>
  );
}
