"use client";

import { createLocalStore, useLocalStore } from "@/lib/local-store";
import {
  WISHLIST_STORAGE_KEY,
  mergeItems,
  parseStoredWishlist,
  toggleItem,
  type WishlistItem,
} from "@/lib/wishlist";

const EMPTY: WishlistItem[] = [];
const store = createLocalStore<WishlistItem[]>(WISHLIST_STORAGE_KEY, parseStoredWishlist, EMPTY);

export function useWishlist() {
  const items = useLocalStore(store);
  return {
    items,
    count: items.length,
    has: (slug: string) => items.some((i) => i.slug === slug),
    toggle: (slug: string, variantId?: string) => store.set(toggleItem(store.get(), slug, variantId, Date.now())),
    remove: (slug: string) => store.set(store.get().filter((i) => i.slug !== slug)),
    merge: (slugs: string[]) => store.set(mergeItems(store.get(), slugs, Date.now())),
    clear: () => store.set([]),
  };
}
