import type { ArtPalette, Product } from "../types";

/**
 * PREVIEW CATALOG — illustrative samples only.
 *
 * None of these are real inventory. Every item has status "preview",
 * no price and no stock. Replace this provider with a real one at launch
 * (see src/commerce/catalog.ts).
 */

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
    status: "preview",
    shortDescription: "A smiley slushie-cup squishy with a domed lid and bendy straw.",
    description:
      "Sample concept for our Fruity Slushies collection: a slushie-cup squishy with a happy face, domed lid, and bendy straw. Final designs, sizes, and colors will be announced at launch.",
    images: [],
    art: "slushie",
    variants: [
      { id: "pv-berry-slushie-strawberry", name: "Strawberry", swatch: palettes.strawberry.base, palette: palettes.strawberry, price: null, inventory: null },
      { id: "pv-berry-slushie-blue", name: "Blue Raspberry", swatch: palettes.blueRaspberry.base, palette: palettes.blueRaspberry, price: null, inventory: null },
      { id: "pv-berry-slushie-lemon", name: "Lemon Fizz", swatch: palettes.lemon.base, palette: palettes.lemon, price: null, inventory: null },
    ],
    tags: ["slushie", "fruit", "sample"],
    featuredRank: 1,
    createdAt: "2026-10-01",
  },
  {
    id: "pv-icy-slushie",
    slug: "icy-blue-slushie",
    name: "Icy Blue Slushie",
    category: "fruity-slushies",
    status: "preview",
    shortDescription: "A frosty blue slushie concept with a sprinkle of snowflakes.",
    description:
      "Sample concept: an icy-blue slushie-cup squishy inspired by our brand colors. This is an illustration of the style we're exploring, not a product for sale.",
    images: [],
    art: "slushie",
    variants: [
      { id: "pv-icy-slushie-ice", name: "Ice Blue", swatch: palettes.iceBlue.base, palette: palettes.iceBlue, price: null, inventory: null },
      { id: "pv-icy-slushie-lime", name: "Lime Chill", swatch: palettes.lime.base, palette: palettes.lime, price: null, inventory: null },
    ],
    tags: ["slushie", "blue", "sample"],
    featuredRank: 5,
    createdAt: "2026-10-05",
  },
  {
    id: "pv-grape-jelly",
    slug: "grape-jelly-bear",
    name: "Grape Jelly Bear",
    category: "jelly-squishies",
    status: "preview",
    shortDescription: "A glossy, see-through jelly bear concept with extra wobble.",
    description:
      "Sample concept for our Jelly Squishies collection: a translucent jelly bear that wobbles when you squeeze it. Final details will be shared when real products are ready.",
    images: [],
    art: "jelly",
    variants: [
      { id: "pv-grape-jelly-grape", name: "Grape", swatch: palettes.grape.base, palette: palettes.grape, price: null, inventory: null },
      { id: "pv-grape-jelly-blue", name: "Blue Raspberry", swatch: palettes.blueRaspberry.base, palette: palettes.blueRaspberry, price: null, inventory: null },
      { id: "pv-grape-jelly-strawberry", name: "Strawberry", swatch: palettes.strawberry.base, palette: palettes.strawberry, price: null, inventory: null },
    ],
    tags: ["jelly", "bear", "sample"],
    featuredRank: 2,
    createdAt: "2026-10-02",
  },
  {
    id: "pv-cloud-jelly",
    slug: "cloud-drop-jelly",
    name: "Cloud Drop Jelly",
    category: "jelly-squishies",
    status: "preview",
    shortDescription: "A soft-blue jelly bear concept that looks like a sky-colored gummy.",
    description:
      "Sample concept: a sky-blue jelly squishy with a glossy finish. Shown here as an illustration only.",
    images: [],
    art: "jelly",
    variants: [
      { id: "pv-cloud-jelly-ice", name: "Sky", swatch: palettes.iceBlue.base, palette: palettes.iceBlue, price: null, inventory: null },
      { id: "pv-cloud-jelly-mint", name: "Mint", swatch: palettes.mint.base, palette: palettes.mint, price: null, inventory: null },
    ],
    tags: ["jelly", "blue", "sample"],
    featuredRank: 6,
    createdAt: "2026-10-06",
  },
  {
    id: "pv-peach-crunch",
    slug: "peach-crunch-bun",
    name: "Peach Crunch Bun",
    category: "crunchy-squishies",
    status: "preview",
    shortDescription: "A sprinkle-topped bun concept with a crunchy-texture center.",
    description:
      "Sample concept for our Crunchy Squishies collection: a bakery-style bun with sprinkles on top and a crunchy feel inside. Textures and sizes will be confirmed with real samples.",
    images: [],
    art: "crunchy",
    variants: [
      { id: "pv-peach-crunch-peach", name: "Peach", swatch: palettes.peach.base, palette: palettes.peach, price: null, inventory: null },
      { id: "pv-peach-crunch-vanilla", name: "Vanilla", swatch: palettes.vanilla.base, palette: palettes.vanilla, price: null, inventory: null },
    ],
    tags: ["crunchy", "bun", "sample"],
    featuredRank: 3,
    createdAt: "2026-10-03",
  },
  {
    id: "pv-lemon-crunch",
    slug: "lemon-sprinkle-crunch",
    name: "Lemon Sprinkle Crunch",
    category: "crunchy-squishies",
    status: "preview",
    shortDescription: "A sunny yellow crunchy concept covered in candy sprinkles.",
    description:
      "Sample concept: a lemon-yellow crunchy squishy with candy sprinkles. Illustration only.",
    images: [],
    art: "crunchy",
    variants: [
      { id: "pv-lemon-crunch-lemon", name: "Lemon", swatch: palettes.lemon.base, palette: palettes.lemon, price: null, inventory: null },
      { id: "pv-lemon-crunch-berry", name: "Berry", swatch: palettes.strawberry.base, palette: palettes.strawberry, price: null, inventory: null },
    ],
    tags: ["crunchy", "sprinkles", "sample"],
    featuredRank: 7,
    createdAt: "2026-10-07",
  },
  {
    id: "pv-mint-capsule",
    slug: "mint-mystery-capsule",
    name: "Mint Mystery Capsule",
    category: "cute-collectibles",
    status: "preview",
    shortDescription: "A capsule-toy concept with a tiny squishy friend inside.",
    description:
      "Sample concept for our Cute Collectibles collection: a capsule with a mini character inside. Collection details are still being planned.",
    images: [],
    art: "capsule",
    variants: [
      { id: "pv-mint-capsule-mint", name: "Mint", swatch: palettes.mint.base, palette: palettes.mint, price: null, inventory: null },
      { id: "pv-mint-capsule-grape", name: "Grape", swatch: palettes.grape.base, palette: palettes.grape, price: null, inventory: null },
      { id: "pv-mint-capsule-sky", name: "Sky", swatch: palettes.blueRaspberry.base, palette: palettes.blueRaspberry, price: null, inventory: null },
    ],
    tags: ["collectible", "capsule", "sample"],
    featuredRank: 4,
    createdAt: "2026-10-04",
  },
  {
    id: "pv-cloud-capsule",
    slug: "cloud-buddy-capsule",
    name: "Cloud Buddy Capsule",
    category: "cute-collectibles",
    status: "preview",
    shortDescription: "A soft-blue capsule concept with a sleepy cloud friend.",
    description:
      "Sample concept: a pastel capsule with a cloud-shaped mini friend. Illustration only.",
    images: [],
    art: "capsule",
    variants: [
      { id: "pv-cloud-capsule-cloud", name: "Cloud", swatch: palettes.cloud.base, palette: palettes.cloud, price: null, inventory: null },
      { id: "pv-cloud-capsule-peach", name: "Peach", swatch: palettes.peach.base, palette: palettes.peach, price: null, inventory: null },
    ],
    tags: ["collectible", "capsule", "sample"],
    featuredRank: 8,
    createdAt: "2026-10-08",
  },
];

export { palettes as previewPalettes };
