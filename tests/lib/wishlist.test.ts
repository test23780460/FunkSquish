import { describe, expect, it } from "vitest";
import {
  WISHLIST_MAX_ITEMS,
  decodeShareList,
  encodeShareList,
  mergeItems,
  parseStoredWishlist,
  sanitizeWishlist,
  toggleItem,
} from "@/lib/wishlist";

describe("wishlist storage", () => {
  it("survives corrupt or hostile storage values", () => {
    expect(parseStoredWishlist(null)).toEqual([]);
    expect(parseStoredWishlist("{not json")).toEqual([]);
    expect(parseStoredWishlist('{"slug":"x"}')).toEqual([]);
    expect(
      sanitizeWishlist([
        { slug: "grape-jelly-bear", addedAt: 5 },
        { slug: "grape-jelly-bear", addedAt: 6 }, // duplicate
        { slug: "<script>", addedAt: 1 },
        { slug: "Bad Slug" },
        null,
        "string",
        { slug: "berry-burst-slushie", variantId: "javascript:alert(1)", addedAt: "x" },
      ]),
    ).toEqual([
      { slug: "grape-jelly-bear", addedAt: 5 },
      { slug: "berry-burst-slushie", addedAt: 0 },
    ]);
  });

  it("caps the list size", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ slug: `item-${i}`, addedAt: i }));
    expect(sanitizeWishlist(many)).toHaveLength(WISHLIST_MAX_ITEMS);
  });

  it("toggles items on and off, newest first", () => {
    let list = toggleItem([], "a-one", undefined, 1);
    list = toggleItem(list, "b-two", "b-two-blue", 2);
    expect(list.map((i) => i.slug)).toEqual(["b-two", "a-one"]);
    expect(list[0].variantId).toBe("b-two-blue");
    expect(toggleItem(list, "a-one", undefined, 3).map((i) => i.slug)).toEqual(["b-two"]);
    expect(toggleItem(list, "NOT VALID", undefined, 3)).toBe(list);
  });
});

describe("wishlist sharing", () => {
  it("shares slugs only, and reads them back safely", () => {
    const value = encodeShareList(["grape-jelly-bear", "grape-jelly-bear", "bad slug!", "icy-blue-slushie"]);
    expect(value).toBe("grape-jelly-bear,icy-blue-slushie");
    expect(decodeShareList(value)).toEqual(["grape-jelly-bear", "icy-blue-slushie"]);
  });

  it("ignores junk in shared links", () => {
    expect(decodeShareList(null)).toEqual([]);
    expect(decodeShareList("x".repeat(5000))).toEqual([]);
    expect(decodeShareList("ok-one,<img src=x>,../../etc, OK-TWO ")).toEqual(["ok-one", "ok-two"]);
  });

  it("merges a shared list without duplicating what you have", () => {
    const mine = [{ slug: "a-one", addedAt: 1 }];
    expect(mergeItems(mine, ["a-one", "b-two"], 10).map((i) => i.slug)).toEqual(["b-two", "a-one"]);
  });
});
