import type { ArtPalette } from "../types";

/** Illustration colors from a swatch hex (same math as scripts/catalog-lib.mjs paletteFromHex). */
export function paletteFrom(hex: string): ArtPalette {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const base = m ? `#${m[1].toLowerCase()}` : "#4ea8ff";
  const n = parseInt(base.slice(1), 16);
  const mix = (t: number) => {
    const ch = [16, 8, 0].map((s) => (n >> s) & 255).map((c) => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)));
    return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };
  return { base, light: mix(0.6), shade: mix(-0.3), accent: "#ffffff" };
}
