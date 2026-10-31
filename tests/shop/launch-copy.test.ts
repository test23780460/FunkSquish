import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIVE, PRE_LAUNCH, launchCopy } from "@/content/launch";

describe("launch wording follows the purchasing switch", () => {
  it("purchasing is off today, so the pre-launch wording shows", () => {
    expect(launchCopy).toBe(PRE_LAUNCH);
  });

  it("the live wording makes no pre-launch or date claims", () => {
    const text = JSON.stringify(LIVE);
    expect(text).not.toMatch(/coming soon|isn't open|not open|launch day|\d{4}-\d{2}-\d{2}/i);
    expect(LIVE.orderHelpNotice).toBeNull();
  });

  it("the homepage, footer, title, share image and order help all use it", () => {
    for (const f of ["src/components/home/Hero.tsx", "src/components/layout/SiteFooter.tsx", "src/app/layout.tsx", "src/app/opengraph-image.tsx", "src/app/order-help/page.tsx"])
      expect(readFileSync(f, "utf8"), f).toContain("launchCopy.");
    expect(readFileSync("src/components/home/Hero.tsx", "utf8")).not.toMatch(/>\s*Coming soon\s*</);
  });
});
