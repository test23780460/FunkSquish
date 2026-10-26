import type { ArtPalette, ProductArtKind, TextureId } from "@/commerce/types";

export type { TextureId };

/**
 * The five squishy textures used across the Squish Lab, the quiz and product pages.
 *
 * These describe texture STYLES in general — how that kind of squishy tends to
 * feel — not claims about any FunkSquish product. A product only shows a
 * texture once the owner has confirmed it with a real sample (`Product.textures`).
 *
 * Meters are 1–5 and are relative to each other, not measurements.
 */
export const TEXTURE_IDS: readonly TextureId[] = ["soft", "slow-rise", "jelly", "crunchy", "buttery"];

export interface TextureMeters {
  /** How far it gives under your fingers. */
  squish: number;
  /** How quickly it comes back to shape. */
  bounceBack: number;
  /** How much it makes a sound. */
  sound: number;
}

/** Tuning for the on-screen squish demo (see lib/squish-physics.ts). */
export interface TexturePhysics {
  /** How deep a full press squashes the blob (0–0.6). */
  depth: number;
  /** Seconds to reach full depth while pressing. */
  pressSeconds: number;
  /** Spring stiffness on release (higher = snappier). Ignored when `riseSeconds` is set. */
  stiffness: number;
  /** Spring damping on release (lower = wobblier). */
  damping: number;
  /** If set, the shape eases back over this many seconds with no wobble (slow-rise). */
  riseSeconds?: number;
  /** Crunch "steps" while pressing (crunchy). */
  crackles?: number;
}

export interface Texture {
  id: TextureId;
  name: string;
  tagline: string;
  description: string;
  /** What it's like to squeeze, in plain words. */
  feelsLike: string[];
  meters: TextureMeters;
  physics: TexturePhysics;
  /** Illustration used for the demo blob. */
  art: ProductArtKind;
  palette: ArtPalette;
  /** Tailwind classes for chips and cards (text stays ink for contrast). */
  tone: { soft: string; solid: string; ring: string; text: string };
}

export const textures: Texture[] = [
  {
    id: "soft",
    name: "Cloud Soft",
    tagline: "Pillowy and light",
    description:
      "The classic squishy feel: light and pillowy, it squeezes easily and pops back to shape in a blink.",
    feelsLike: ["Easy, gentle squeeze", "Springs back quickly", "Quiet"],
    meters: { squish: 4, bounceBack: 4, sound: 1 },
    physics: { depth: 0.38, pressSeconds: 0.18, stiffness: 190, damping: 16 },
    art: "slushie",
    palette: { base: "#8fd0ff", light: "#dff2ff", shade: "#3d8fe0", accent: "#ffffff" },
    tone: { soft: "bg-ice", solid: "bg-sky", ring: "ring-sky-300", text: "text-royal" },
  },
  {
    id: "slow-rise",
    name: "Slow Rise",
    tagline: "Squeeze it, watch it rise",
    description:
      "Slow-rise squishies take their time. Squeeze one flat and it slowly, s-l-o-w-l-y puffs back up to its full shape.",
    feelsLike: ["Deep, soft squeeze", "Rises back slowly", "Silent"],
    meters: { squish: 5, bounceBack: 1, sound: 1 },
    physics: { depth: 0.46, pressSeconds: 0.35, stiffness: 0, damping: 0, riseSeconds: 2.8 },
    art: "capsule",
    palette: { base: "#ffb27a", light: "#ffe1c9", shade: "#e07a35", accent: "#ff7aa8" },
    tone: { soft: "bg-peach-soft", solid: "bg-peach", ring: "ring-peach/50", text: "text-[#a8490c]" },
  },
  {
    id: "jelly",
    name: "Jelly Wobble",
    tagline: "Glossy, jiggly, bouncy",
    description:
      "Jelly squishies are glossy and see-through. Give one a squeeze and it wobbles and jiggles before settling back.",
    feelsLike: ["Smooth and stretchy", "Wobbles back", "Quiet"],
    meters: { squish: 3, bounceBack: 5, sound: 1 },
    physics: { depth: 0.3, pressSeconds: 0.14, stiffness: 260, damping: 5 },
    art: "jelly",
    palette: { base: "#a68aff", light: "#ddd2ff", shade: "#6e4fd9", accent: "#ffffff" },
    tone: { soft: "bg-grape-soft", solid: "bg-grape", ring: "ring-grape/50", text: "text-[#5a3cc4]" },
  },
  {
    id: "crunchy",
    name: "Crunch Time",
    tagline: "Squeeze it. Hear it.",
    description:
      "Crunchy squishies have a crackly texture that you can feel and hear as you squeeze — very satisfying.",
    feelsLike: ["Firm with a crackle", "Comes back steadily", "Crunchy sound"],
    meters: { squish: 2, bounceBack: 3, sound: 5 },
    physics: { depth: 0.24, pressSeconds: 0.5, stiffness: 150, damping: 20, crackles: 6 },
    art: "crunchy",
    palette: { base: "#ffd45e", light: "#fff0b8", shade: "#e0a722", accent: "#ff7aa8" },
    tone: { soft: "bg-lemon-soft", solid: "bg-lemon", ring: "ring-lemon", text: "text-[#8a5d00]" },
  },
  {
    id: "buttery",
    name: "Buttery Smooth",
    tagline: "Dense, velvety, melty",
    description:
      "Buttery squishies are dense and velvety. Your fingers sink in slowly, like pressing into soft butter.",
    feelsLike: ["Slow, dense sink", "Eases back gently", "Very quiet"],
    meters: { squish: 4, bounceBack: 2, sound: 1 },
    physics: { depth: 0.36, pressSeconds: 0.9, stiffness: 60, damping: 14 },
    art: "crunchy",
    palette: { base: "#ffe7b8", light: "#fff7e6", shade: "#d9a75b", accent: "#4ea8ff" },
    tone: { soft: "bg-[#fff7e6]", solid: "bg-[#ffe7b8]", ring: "ring-[#e8c88a]", text: "text-[#8a5a12]" },
  },
];

export function getTexture(id: string | null | undefined): Texture | undefined {
  return textures.find((t) => t.id === id);
}

export function isTextureId(value: unknown): value is TextureId {
  return typeof value === "string" && (TEXTURE_IDS as readonly string[]).includes(value);
}

export const meterLabels: Record<keyof TextureMeters, string> = {
  squish: "Squish",
  bounceBack: "Bounce-back",
  sound: "Sound",
};
