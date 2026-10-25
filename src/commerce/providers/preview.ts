import type { ArtPalette, Product, ProductSafety, ProductSpecs, ProductVariant } from "../types";

/**
 * PREVIEW CATALOG — illustrative samples only.
 *
 * None of these are real inventory. Every item has publication "preview",
 * no price, untracked stock and unconfirmed specs. Real products are added
 * through the catalog template (see docs/CATALOG.md), not here.
 */

/** Specs/safety for samples: nothing is confirmed, so everything is null. */
const UNCONFIRMED_SPECS: ProductSpecs = { material: null, fill: null, texture: null, sizeDescription: null };
const UNCONFIRMED_SAFETY: ProductSafety = {
  ageGrade: null,
  warnings: [],
  careInstructions: [],
  manufacturerOrImporter: null,
  countryOfOrigin: null,
};

/** Builds a sample variant: no price, untracked inventory, unknown weight. */
function sample(
  id: string,
  name: string,
  palette: ArtPalette,
): ProductVariant {
  return {
    id,
    sku: `SAMPLE-${id.replace(/^pv-/, "").toUpperCase()}`,
    name,
    swatch: palette.base,
    palette,
    price: null,
    compareAtPrice: null,
    inventory: { tracked: false, available: null },
    weightGrams: null,
    dimensions: null,
    externalPurchaseUrl: null,
  };
}

const palettes = {
  strawberry: { base: "#ff7aa8", light: "#ffc2d6", shade: "#d9457a", accent: "#ffffff" },
  blueRaspberry: { base: "#4ea8ff", light: "#b9defe", shade: "#1f5fd6", accent: "#ffffff" },
  lemon: { base: "#ffd45e", light: "#fff0b8", shade: "#e0a722", accent: "#ff7aa8" },
  grape: { base: "#a68aff", light: "#ddd2ff", shade: "#6e4fd9", accent: "#ffffff" },
  iceBlue: { base: "#8fd0ff", light: "#dff2ff", shade: "#3d8fe0", accent: "#ffffff" },
  lime: { base: "#7fe08a", light: "#d3f7d6", shade: "#3fa64d", accent: "#ffffff" },
  peach: { base: "#ffb27a", light: "#ffe1c9", shade: "#e07a35", accent: "#ff7aa8" },
  vanilla: { base: "#ffe7b8", light: "#fff7e6", shade: "#d9a75b", accent: "#4ea8ff" },
  mint: { base: "#5fe0c1", light: "#c9f6ea", shade: "#22a585", accent: "#ff7aa8" },
  cloud: { base: "#cfe8ff", light: "#ffffff", shade: "#6aa9e6", accent: "#ffd45e" },
} satisfies Record<string, ArtPalette>;

export const previewProducts: Product[] = [
  {
    id: "pv-berry-slushie",
    slug: "berry-burst-slushie",
    name: "Berry Burst Slushie",
    category: "fruity-slushies",
    publication: "preview",
    shortDescription: "A smiley slushie-cup squishy with a domed lid and bendy straw.",
    description:
      "Sample concept for our Fruity Slushies collection: a slushie-cup squishy with a happy face, domed lid, and bendy straw. Final designs, sizes, and colors will be announced at launch.",
    media: [],
    art: "slushie",
    variants: [
      sample("pv-berry-slushie-strawberry", "Strawberry", palettes.strawberry),
      sample("pv-berry-slushie-blue", "Blue Raspberry", palettes.blueRaspberry),
      sample("pv-berry-slushie-lemon", "Lemon Fizz", palettes.lemon),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["slushie", "fruit", "sample"],
    featuredRank: 1,
    createdAt: "2026-10-01",
  },
  {
    id: "pv-icy-slushie",
    slug: "icy-blue-slushie",
    name: "Icy Blue Slushie",
    category: "fruity-slushies",
    publication: "preview",
    shortDescription: "A frosty blue slushie concept with a sprinkle of snowflakes.",
    description:
      "Sample concept: an icy-blue slushie-cup squishy inspired by our brand colors. This is an illustration of the style we're exploring, not a product for sale.",
    media: [],
    art: "slushie",
    variants: [
      sample("pv-icy-slushie-ice", "Ice Blue", palettes.iceBlue),
      sample("pv-icy-slushie-lime", "Lime Chill", palettes.lime),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["slushie", "blue", "sample"],
    featuredRank: 5,
    createdAt: "2026-10-05",
  },
  {
    id: "pv-grape-jelly",
    slug: "grape-jelly-bear",
    name: "Grape Jelly Bear",
    category: "jelly-squishies",
    publication: "preview",
    shortDescription: "A glossy, see-through jelly bear concept with extra wobble.",
    description:
      "Sample concept for our Jelly Squishies collection: a translucent jelly bear that wobbles when you squeeze it. Final details will be shared when real products are ready.",
    media: [],
    art: "jelly",
    variants: [
      sample("pv-grape-jelly-grape", "Grape", palettes.grape),
      sample("pv-grape-jelly-blue", "Blue Raspberry", palettes.blueRaspberry),
      sample("pv-grape-jelly-strawberry", "Strawberry", palettes.strawberry),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["jelly", "bear", "sample"],
    textures: ["jelly"],
    featuredRank: 2,
    createdAt: "2026-10-02",
  },
  {
    id: "pv-cloud-jelly",
    slug: "cloud-drop-jelly",
    name: "Cloud Drop Jelly",
    category: "jelly-squishies",
    publication: "preview",
    shortDescription: "A soft-blue jelly bear concept that looks like a sky-colored gummy.",
    description:
      "Sample concept: a sky-blue jelly squishy with a glossy finish. Shown here as an illustration only.",
    media: [],
    art: "jelly",
    variants: [
      sample("pv-cloud-jelly-ice", "Sky", palettes.iceBlue),
      sample("pv-cloud-jelly-mint", "Mint", palettes.mint),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["jelly", "blue", "sample"],
    textures: ["jelly"],
    featuredRank: 6,
    createdAt: "2026-10-06",
  },
  {
    id: "pv-peach-crunch",
    slug: "peach-crunch-bun",
    name: "Peach Crunch Bun",
    category: "crunchy-squishies",
    publication: "preview",
    shortDescription: "A sprinkle-topped bun concept with a crunchy-texture center.",
    description:
      "Sample concept for our Crunchy Squishies collection: a bakery-style bun with sprinkles on top and a crunchy feel inside. Textures and sizes will be confirmed with real samples.",
    media: [],
    art: "crunchy",
    variants: [
      sample("pv-peach-crunch-peach", "Peach", palettes.peach),
      sample("pv-peach-crunch-vanilla", "Vanilla", palettes.vanilla),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["crunchy", "bun", "sample"],
    textures: ["crunchy"],
    featuredRank: 3,
    createdAt: "2026-10-03",
  },
  {
    id: "pv-lemon-crunch",
    slug: "lemon-sprinkle-crunch",
    name: "Lemon Sprinkle Crunch",
    category: "crunchy-squishies",
    publication: "preview",
    shortDescription: "A sunny yellow crunchy concept covered in candy sprinkles.",
    description:
      "Sample concept: a lemon-yellow crunchy squishy with candy sprinkles. Illustration only.",
    media: [],
    art: "crunchy",
    variants: [
      sample("pv-lemon-crunch-lemon", "Lemon", palettes.lemon),
      sample("pv-lemon-crunch-berry", "Berry", palettes.strawberry),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["crunchy", "sprinkles", "sample"],
    textures: ["crunchy"],
    featuredRank: 7,
    createdAt: "2026-10-07",
  },
  {
    id: "pv-mint-capsule",
    slug: "mint-mystery-capsule",
    name: "Mint Mystery Capsule",
    category: "cute-collectibles",
    publication: "preview",
    shortDescription: "A capsule-toy concept with a tiny squishy friend inside.",
    description:
      "Sample concept for our Cute Collectibles collection: a capsule with a mini character inside. Collection details are still being planned.",
    media: [],
    art: "capsule",
    variants: [
      sample("pv-mint-capsule-mint", "Mint", palettes.mint),
      sample("pv-mint-capsule-grape", "Grape", palettes.grape),
      sample("pv-mint-capsule-sky", "Sky", palettes.blueRaspberry),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["collectible", "capsule", "sample"],
    featuredRank: 4,
    createdAt: "2026-10-04",
  },
  {
    id: "pv-cloud-capsule",
    slug: "cloud-buddy-capsule",
    name: "Cloud Buddy Capsule",
    category: "cute-collectibles",
    publication: "preview",
    shortDescription: "A soft-blue capsule concept with a sleepy cloud friend.",
    description:
      "Sample concept: a pastel capsule with a cloud-shaped mini friend. Illustration only.",
    media: [],
    art: "capsule",
    variants: [
      sample("pv-cloud-capsule-cloud", "Cloud", palettes.cloud),
      sample("pv-cloud-capsule-peach", "Peach", palettes.peach),
    ],
    specs: UNCONFIRMED_SPECS,
    safety: UNCONFIRMED_SAFETY,
    tags: ["collectible", "capsule", "sample"],
    featuredRank: 8,
    createdAt: "2026-10-08",
  },
];

export { palettes as previewPalettes };
