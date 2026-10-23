/**
 * Commerce domain types.
 *
 * These are provider-agnostic: a future Shopify / Stripe / TikTok Shop adapter
 * maps its own data into these shapes, so the UI never has to change.
 */

export type CategorySlug =
  | "fruity-slushies"
  | "jelly-squishies"
  | "crunchy-squishies"
  | "cute-collectibles";

/** Visual theme tokens for a category (see globals.css colors). */
export type CategoryTheme = "berry" | "grape" | "peach" | "mint";

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  description: string;
  theme: CategoryTheme;
  /** Which illustration represents this category. */
  art: ProductArtKind;
}

/** Money is stored in minor units (cents) to avoid floating point issues. */
export interface Money {
  amount: number;
  currency: "USD";
}

/**
 * - preview:     illustrative sample, not real inventory (pre-launch only)
 * - coming-soon: real product announced, not yet purchasable
 * - available:   in stock and purchasable
 * - sold-out:    real product, no stock
 */
export type ProductStatus = "preview" | "coming-soon" | "available" | "sold-out";

/** Illustration families drawn in /components/illustrations. */
export type ProductArtKind = "slushie" | "jelly" | "crunchy" | "capsule";

export interface ArtPalette {
  /** main body color */
  base: string;
  /** lighter highlight color */
  light: string;
  /** darker outline / shade color */
  shade: string;
  /** small accent (toppings, straw, etc.) */
  accent: string;
}

export interface ProductImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  /** Swatch color shown in the variant picker. */
  swatch: string;
  /** Illustration palette used while real photos don't exist. */
  palette: ArtPalette;
  price: Money | null;
  /** null = not tracked yet. 0 = sold out. */
  inventory: number | null;
  sku?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  status: ProductStatus;
  shortDescription: string;
  description: string;
  /** Real product photos. Empty during pre-launch -> illustration is used. */
  images: ProductImage[];
  art: ProductArtKind;
  variants: ProductVariant[];
  tags: string[];
  /** Lower = shown first under "Featured" sort. */
  featuredRank: number;
  /** ISO date the product was added (used by "Newest" sort). */
  createdAt: string;
}
