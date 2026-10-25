/**
 * Wishlist data helpers (pure; safe for client and server).
 *
 * A wishlist lives only in the visitor's browser (localStorage). Nothing is
 * sent to FunkSquish. Shared links contain product slugs only — never names,
 * emails or anything personal.
 */
export interface WishlistItem {
  slug: string;
  /** Color the visitor had picked, if any. */
  variantId?: string;
  /** ms since epoch. */
  addedAt: number;
}

export const WISHLIST_STORAGE_KEY = "funksquish-wishlist-v1";
export const WISHLIST_MAX_ITEMS = 50;
export const SHARE_PARAM = "list";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && SLUG.test(value);
}

/** Cleans whatever was in storage: drops bad entries and duplicates, caps the size. */
export function sanitizeWishlist(raw: unknown): WishlistItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WishlistItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { slug, variantId, addedAt } = entry as Record<string, unknown>;
    if (!isSlug(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      slug,
      ...(typeof variantId === "string" && ID.test(variantId) ? { variantId } : {}),
      addedAt: typeof addedAt === "number" && Number.isFinite(addedAt) ? addedAt : 0,
    });
    if (out.length >= WISHLIST_MAX_ITEMS) break;
  }
  return out;
}

export function parseStoredWishlist(json: string | null): WishlistItem[] {
  if (!json) return [];
  try {
    return sanitizeWishlist(JSON.parse(json));
  } catch {
    return [];
  }
}

/** `?list=` value for a shareable link. */
export function encodeShareList(slugs: string[]): string {
  return [...new Set(slugs.filter(isSlug))].slice(0, WISHLIST_MAX_ITEMS).join(",");
}

/** Reads a shared `?list=` value. Unknown slugs are filtered later against the catalog. */
export function decodeShareList(value: string | null | undefined): string[] {
  if (!value || value.length > 4000) return [];
  return [...new Set(value.split(",").map((s) => s.trim().toLowerCase()).filter(isSlug))].slice(0, WISHLIST_MAX_ITEMS);
}

export function toggleItem(items: WishlistItem[], slug: string, variantId: string | undefined, now: number): WishlistItem[] {
  if (!isSlug(slug)) return items;
  if (items.some((i) => i.slug === slug)) return items.filter((i) => i.slug !== slug);
  if (items.length >= WISHLIST_MAX_ITEMS) return items;
  return [{ slug, ...(variantId ? { variantId } : {}), addedAt: now }, ...items];
}

/** Adds shared items the visitor doesn't already have. */
export function mergeItems(items: WishlistItem[], slugs: string[], now: number): WishlistItem[] {
  const have = new Set(items.map((i) => i.slug));
  const added = slugs.filter((s) => isSlug(s) && !have.has(s)).map((slug, i) => ({ slug, addedAt: now - i }));
  return sanitizeWishlist([...added, ...items]);
}
