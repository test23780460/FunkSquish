import type { ProductVariant } from "./types";

/**
 * Shipping configuration — PREPARED, DISABLED.
 *
 * Every business decision here is `null` until the owner decides it.
 * Nothing is calculated or charged while `enabled` is false. When a commerce
 * platform (Shopify / TikTok Shop) is connected, live rates and labels come
 * from that platform; this file then only documents the packaging setup and
 * supports weight checks for label generation.
 */
export interface PackagePreset {
  id: string;
  name: string;
  /** Inside dimensions in cm. */
  dimensionsCm: { length: number; width: number; height: number } | null;
  /** Empty package + padding weight in grams. */
  tareGrams: number | null;
  maxContentsGrams: number | null;
}

export interface ShippingConfig {
  enabled: false;
  /** Ship-from ZIP code — never publish a home address. */
  originPostalCode: string | null;
  /** Countries we ship to (ISO codes). Empty until decided. */
  destinations: string[];
  /** Carrier services under consideration, e.g. "USPS Ground Advantage". */
  carrierServices: string[];
  /** Business days to pack an order. */
  handlingDays: { min: number; max: number } | null;
  /** Free-shipping threshold in cents, if any. */
  freeShippingThresholdCents: number | null;
  packages: PackagePreset[];
}

export const shippingConfig: ShippingConfig = {
  enabled: false,
  originPostalCode: null,
  destinations: [],
  carrierServices: [],
  handlingDays: null,
  freeShippingThresholdCents: null,
  packages: [
    { id: "mailer-small", name: "Small padded mailer (1–2 squishies)", dimensionsCm: null, tareGrams: null, maxContentsGrams: null },
    { id: "box-small", name: "Small box (fragile or multiple items)", dimensionsCm: null, tareGrams: null, maxContentsGrams: null },
  ],
};

/**
 * Total parcel weight for a set of lines in a package, for future label
 * generation. Returns null (never a guess) if any weight is unknown.
 */
export function parcelWeightGrams(lines: { variant: ProductVariant; quantity: number }[], pkg: PackagePreset): number | null {
  if (pkg.tareGrams === null) return null;
  let total = pkg.tareGrams;
  for (const { variant, quantity } of lines) {
    if (variant.weightGrams === null) return null;
    total += variant.weightGrams * quantity;
  }
  if (pkg.maxContentsGrams !== null && total - pkg.tareGrams > pkg.maxContentsGrams) return null;
  return total;
}

/** Shipping quotes are not available until a real provider is connected. */
export function quoteShipping(): never {
  throw new Error("Shipping rates are not available yet — connect a commerce platform or shipping provider first.");
}
