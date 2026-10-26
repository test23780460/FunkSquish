import { describe, expect, it } from "vitest";
import { validateProducts } from "@/commerce/validate";
import { previewProducts } from "@/commerce/providers/preview";

const clone = () => structuredClone(previewProducts[0]);

describe("catalog validation", () => {
  it("accepts the preview catalog", () => {
    expect(() => validateProducts(structuredClone(previewProducts))).not.toThrow();
  });

  it("only allows known texture ids", () => {
    const p = { ...clone(), textures: ["jelly", "made-up"] };
    expect(() => validateProducts([p])).toThrow(/textures/);
  });

  it("only allows our own media files (no hotlinked images)", () => {
    const good = { ...clone(), media: [{ type: "video", src: "/products/berry/squeeze.mp4", alt: "Squeezing it", width: 1080, height: 1080, poster: "/products/berry/poster.webp", captions: "/products/berry/squeeze.vtt" }] };
    expect(() => validateProducts([good])).not.toThrow();
    for (const src of ["https://example.com/photo.jpg", "/../secret.png", "javascript:alert(1)"]) {
      const bad = { ...clone(), media: [{ type: "image", src, alt: "x", width: 1, height: 1 }] };
      expect(() => validateProducts([bad])).toThrow(/media/);
    }
    const badCaptions = { ...clone(), media: [{ ...good.media[0], captions: "/products/berry/squeeze.txt" }] };
    expect(() => validateProducts([badCaptions])).toThrow(/captions/);
  });
});
