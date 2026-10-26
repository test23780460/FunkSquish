import { describe, expect, it } from "vitest";
import {
  addItem,
  cleanName,
  decodeBox,
  emptyBox,
  encodeBox,
  removeAt,
  sanitizeBox,
  setSize,
  surpriseFill,
  type BoxDraft,
} from "@/lib/squish-box";

describe("Squish Box", () => {
  it("never overfills a box", () => {
    let box: BoxDraft = { ...emptyBox(), size: "mini" };
    for (let i = 0; i < 10; i++) box = addItem(box, `v-${i}`);
    expect(box.items).toEqual(["v-0", "v-1", "v-2"]);
  });

  it("drops picks that don't fit when shrinking, and removes by slot", () => {
    let box = surpriseFill({ ...emptyBox(), size: "mega" }, ["a", "b"], () => 0);
    expect(box.items).toHaveLength(8);
    box = setSize(box, "mini");
    expect(box.items).toHaveLength(3);
    expect(removeAt(box, 1).items).toHaveLength(2);
    expect(removeAt(box, 9)).toBe(box);
  });

  it("round-trips through a share link and filters unknown variants", () => {
    const box = { size: "classic" as const, ribbon: "mint" as const, name: "Crunch Party", items: ["pv-a", "pv-b"] };
    const decoded = decodeBox(new URLSearchParams(encodeBox(box)), new Set(["pv-a"]));
    expect(decoded).toEqual({ ...box, items: ["pv-a"] });
    expect(decodeBox(new URLSearchParams("foo=bar"))).toBeNull();
  });

  it("cleans hostile stored or shared data", () => {
    expect(sanitizeBox({ size: "huge", ribbon: "gold", name: "<b>hi</b>\u0000", items: ["ok-1", "../x", 5, "OK-UPPER"] })).toEqual({
      size: "classic",
      ribbon: "royal",
      name: "bhi/b",
      items: ["ok-1"],
    });
    expect(sanitizeBox(null)).toEqual(emptyBox());
    expect(cleanName("x".repeat(100))).toHaveLength(30);
  });
});
