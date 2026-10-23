import type { ArtPalette, CategoryTheme } from "@/commerce/types";
import { previewPalettes } from "@/commerce/providers/preview";

/** Tailwind classes per collection theme. Text always stays ink for contrast. */
export const themeClasses: Record<
  CategoryTheme,
  { soft: string; solid: string; ring: string; blob: string; text: string; badge: "berry" | "grape" | "peach" | "mint" }
> = {
  berry: { soft: "bg-berry-soft", solid: "bg-berry", ring: "ring-berry/30", blob: "bg-berry/25", text: "text-[#b8215a]", badge: "berry" },
  grape: { soft: "bg-grape-soft", solid: "bg-grape", ring: "ring-grape/30", blob: "bg-grape/25", text: "text-[#5a3cc4]", badge: "grape" },
  peach: { soft: "bg-peach-soft", solid: "bg-peach", ring: "ring-peach/30", blob: "bg-peach/25", text: "text-[#a8490c]", badge: "peach" },
  mint: { soft: "bg-mint-soft", solid: "bg-mint", ring: "ring-mint/40", blob: "bg-mint/30", text: "text-[#0f7a60]", badge: "mint" },
};

/** Illustration palette representing each collection. */
export const themePalette: Record<CategoryTheme, ArtPalette> = {
  berry: previewPalettes.strawberry,
  grape: previewPalettes.grape,
  peach: previewPalettes.peach,
  mint: previewPalettes.mint,
};
