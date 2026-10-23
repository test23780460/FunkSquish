import type { Category, CategorySlug } from "./types";

export const categories: Category[] = [
  {
    slug: "fruity-slushies",
    name: "Fruity Slushies",
    tagline: "Sip-shaped & squeezable",
    description:
      "Slushie-cup squishies in juicy fruit colors, with domed lids, bendy straws, and happy little faces.",
    theme: "berry",
    art: "slushie",
  },
  {
    slug: "jelly-squishies",
    name: "Jelly Squishies",
    tagline: "Wobbly, glossy, jiggly",
    description:
      "See-through jelly squishies that wobble and bounce back. Think gummy-bear vibes with extra jiggle.",
    theme: "grape",
    art: "jelly",
  },
  {
    slug: "crunchy-squishies",
    name: "Crunchy Squishies",
    tagline: "Squeeze it. Hear it.",
    description:
      "Squishies with a satisfying crunchy texture inside. Sprinkle-topped, bakery-cute, and very squeezable.",
    theme: "peach",
    art: "crunchy",
  },
  {
    slug: "cute-collectibles",
    name: "Cute Collectibles",
    tagline: "Tiny friends to collect",
    description:
      "Mini characters and capsule surprises made for shelves, desks, and trading with friends.",
    theme: "mint",
    art: "capsule",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function isCategorySlug(value: string | null | undefined): value is CategorySlug {
  return !!value && categories.some((c) => c.slug === value);
}
