import { describe, expect, it } from "vitest";
import { cn, conflictKey } from "@/components/owner/cn";

describe("owner cn: the last class wins within a utility family", () => {
  it("overrides size, colour, width and shape", () => {
    expect(cn("min-h-11 px-5 text-[0.95rem] bg-white", "min-h-9 px-3.5 text-sm")).toBe("bg-white min-h-9 px-3.5 text-sm");
    expect(cn("w-full rounded-xl", "w-28 rounded-full")).toBe("w-28 rounded-full");
    expect(cn("bg-royal text-white", "bg-[#a3174f]")).toBe("text-white bg-[#a3174f]");
    expect(cn("ring-1 ring-sky-100", "ring-2 ring-lemon")).toBe("ring-2 ring-lemon");
  });

  it("keeps different families, variants and sides apart", () => {
    expect(cn("text-sm text-ink", "text-royal")).toBe("text-sm text-royal");
    expect(cn("ring-1 ring-inset ring-sky-200")).toBe("ring-1 ring-inset ring-sky-200");
    expect(cn("p-5 sm:p-6", "p-0 sm:p-0")).toBe("p-0 sm:p-0");
    expect(cn("rounded-3xl", "first:rounded-t-3xl last:rounded-b-3xl")).toBe("rounded-3xl first:rounded-t-3xl last:rounded-b-3xl");
    expect(cn("hover:bg-ice-50", "bg-white")).toBe("hover:bg-ice-50 bg-white");
    expect(cn("-mx-4 px-4", "sm:mx-0")).toBe("-mx-4 px-4 sm:mx-0");
  });

  it("drops falsy parts and leaves unknown classes alone", () => {
    expect(cn("flex-1", false, null, undefined, "grid-cols-2 animate-pulse")).toBe("flex-1 grid-cols-2 animate-pulse");
    expect(conflictKey("[scrollbar-width:none]")).toBeNull();
    expect(conflictKey("has-[:checked]:bg-white")).toBe("has-[:checked]:bg");
    expect(conflictKey("text-[0.7rem]")).toBe("font-size");
    expect(conflictKey("text-[#a3174f]")).toBe("text-color");
  });
});
