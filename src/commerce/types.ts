/**
 * PUBLIC commerce domain types.
 *
 * Everything in this file may end up in HTML or browser bundles.
 * Supplier costs, supplier references, compliance documents and internal
 * notes must NEVER be added here — they live in the private catalog
 * (`private/`, git-ignored) and are handled only by the scripts in /scripts.
 *
 * These shapes are provider-agnostic: a future Shopify / TikTok Shop / local
 * adapter maps its own data into them, so the UI never has to change.
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
 * Owner-controlled publication lifecycle.
 * - draft:     being prepared, never shown publicly
 * - preview:   illustrative sample shown during pre-launch (not real inventory)
 * - published: real product that may be shown (and sold once commerce is on)
 * - archived:  retired, hidden
 */
export type PublicationStatus = "draft" | "preview" | "published" | "archived";

/** What a shopper is told. Derived — never stored. See `getAvailability`. */
export type Availability = "preview" | "coming-soon" | "in-stock" | "low-stock" | "sold-out" | "unavailable" | "checking";

/** Squishy texture styles (see src/content/textures.ts). */
export type TextureId = "soft" | "slow-rise" | "jelly" | "crunchy" | "buttery";

/** Illustration families drawn in /components/illustrations. */
export type ProductArtKind = "slushie" | "jelly" | "crunchy" | "capsule";

export interface ArtPalette {
  base: string;
  light: string;
  shade: string;
  accent: string;
}

export interface ProductMedia {
  type: "image" | "video";
  /** Path under /public (e.g. /products/berry-burst/main.webp) or an allowed remote URL. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Poster frame for videos. */
  poster?: string;
  /** WebVTT captions/description track for videos (path under /public). */
  captions?: string;
}

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/**
 * Inventory for one variant.
 * `tracked: false` or `available: null` means "unknown" — the site will never
 * claim stock in that case.
 */
export interface InventoryLevel {
  tracked: boolean;
  available: number | null;
  /**
   * Set only for display, by src/commerce/live-stock.ts (never in the catalog):
   * "checking" while the live stock is being read, "paused" when the owner paused
   * it on the website, "unknown" when the live stock couldn't be read. Any of
   * these means no stock is claimed and it can't be bought.
   */
  status?: "checking" | "paused" | "unknown";
}

export interface ProductVariant {
  id: string;
  /** Unique stock-keeping unit. Required for every real variant. */
  sku: string;
  name: string;
  /** Swatch color shown in the variant picker. */
  swatch: string;
  /** Illustration palette used while real photos don't exist. */
  palette: ArtPalette;
  price: Money | null;
  /** Optional "was" price. Only shown when real and higher than `price`. */
  compareAtPrice: Money | null;
  inventory: InventoryLevel;
  /** Shipping weight of one unit incl. retail packaging, in grams. */
  weightGrams: number | null;
  dimensions: Dimensions | null;
  /** Optional link to buy this variant on an external channel (e.g. TikTok Shop). */
  externalPurchaseUrl: string | null;
  /**
   * Who ships this variant. "in_house" = our own stock; "supplier" = an
   * approved partner ships it (fulfilled manually — never auto-purchased).
   * The supplier's identity stays in the private catalog, never here.
   * Missing = "in_house".
   */
  fulfillmentSource?: FulfillmentSource;
  /**
   * Opaque id of the place this variant ships from (see src/commerce/origins.ts),
   * e.g. "supplier-a". Our own stock defaults to "funksquish"; supplier items
   * must name their origin or they can't be checked out.
   */
  fulfillmentOrigin?: string;
}

export type FulfillmentSource = "in_house" | "supplier";

/** Public product specifications. `null` = not confirmed yet. */
export interface ProductSpecs {
  material: string | null;
  fill: string | null;
  texture: string | null;
  sizeDescription: string | null;
}

/**
 * Public safety information. Only fill these in from the manufacturer's
 * labels and certificates — never guess. `null` = not confirmed yet.
 */
export interface ProductSafety {
  /** e.g. "Ages 3+" exactly as printed on the product's age grading. */
  ageGrade: string | null;
  /** Warnings exactly as required/printed (e.g. small-parts choking warning). */
  warnings: string[];
  /** Product-specific care instructions (general care is shown site-wide). */
  careInstructions: string[];
  /** Manufacturer or importer name as shown on the product label. */
  manufacturerOrImporter: string | null;
  countryOfOrigin: string | null;
}

/**
 * Per-product terms the Returns and Shipping policies say we disclose before
 * purchase. Only set from real decisions about a real product.
 */
export interface ProductSalesTerms {
  /** Opened item can't be returned for a change of mind (e.g. mystery / blind-bag). Damaged, defective or wrong items are still covered. */
  finalSaleOnceOpened?: boolean;
  /** Business days to ship after a paid order, when longer than our standard 2 (e.g. supplier-shipped). Whole number 1–30. */
  processingBusinessDays?: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  publication: PublicationStatus;
  shortDescription: string;
  description: string;
  /** Real photos/videos. Empty during pre-launch -> illustration is used. */
  media: ProductMedia[];
  art: ProductArtKind;
  variants: ProductVariant[];
  specs: ProductSpecs;
  safety: ProductSafety;
  tags: string[];
  /**
   * Texture styles this product has, confirmed with a real sample (or, for
   * preview concepts, the texture the concept is designed around). Optional.
   */
  textures?: TextureId[];
  /**
   * Sales terms that must be shown BEFORE purchase (product page buy box, and
   * product cards hand off to the product page instead of buying directly).
   * Missing = our standard terms. See src/commerce/sales-terms.ts.
   */
  salesTerms?: ProductSalesTerms;
  /** Lower = shown first under "Featured" sort. */
  featuredRank: number;
  /** ISO date the product was added (used by "Newest" sort). */
  createdAt: string;
}
