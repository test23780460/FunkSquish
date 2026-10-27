import type { ArtPalette, Availability, CategorySlug, Product, ProductArtKind, TextureId } from "./types";
import { getAvailability, startingPrice, formatMoney } from "./availability";

/**
 * Small, public product snapshot passed to interactive client components
 * (wishlist, Squish Box, quiz) so they don't bundle the full catalog code.
 */
export interface ProductSummary {
  slug: string;
  name: string;
  category: CategorySlug;
  shortDescription: string;
  preview: boolean;
  availability: Availability;
  /** Display price, or null while prices aren't set. Never shown for previews. */
  priceLabel: string | null;
  art: ProductArtKind;
  textures: TextureId[];
  image: { src: string; alt: string } | null;
  variants: { id: string; name: string; swatch: string; palette: ArtPalette }[];
}

export function toProductSummary(p: Product): ProductSummary {
  const price = startingPrice(p);
  const image = p.media.find((m) => m.type === "image");
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    shortDescription: p.shortDescription,
    preview: p.publication === "preview",
    availability: getAvailability(p),
    priceLabel: p.publication === "published" && price ? formatMoney(price) : null,
    art: p.art,
    textures: p.textures ?? [],
    image: image ? { src: image.src, alt: image.alt } : null,
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, swatch: v.swatch, palette: v.palette })),
  };
}
