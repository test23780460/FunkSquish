import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { faqGroups } from "@/content/faq";

const read = (f: string) => readFileSync(f, "utf8");

describe("partner applications read as closed while the form is off", () => {
  const page = read("src/app/partners/page.tsx");

  it("says so near the top of the page, with the email route", () => {
    expect(page).toMatch(/\{!open && \(\s*<Notice title="Online applications aren't open yet"/);
  });

  it("the apply section and FAQ answers describe the form only when it's open", () => {
    expect(page).toContain("Our online application isn't open yet, so for now the best way to reach us is email.");
    expect(page).toContain("{open && f.whenOpen ? f.whenOpen : f.a}");
  });

  it("the page description doesn't invite visitors to apply", () => {
    expect(page).not.toMatch(/description:\s*\n?\s*"[^"]*apply to work with/);
  });

  it("the site FAQ doesn't send suppliers to a form that isn't there", () => {
    const answer = faqGroups.flatMap((g) => g.items).find((i) => i.q.startsWith("I'm a supplier"))!.a;
    expect(answer).not.toMatch(/can use our Become a partner page/);
    expect(answer).toContain("explains what we look for and how to get in touch");
  });

  it("the closed box doesn't promise a date", () => {
    expect(read("src/components/partners/PartnerForm.tsx")).not.toContain("open soon");
  });
});

describe("the hosting badge never covers our buttons", () => {
  const css = read("src/app/globals.css");

  it("room is made only while Netlify's badge is on the page", () => {
    expect(css).toMatch(/html:has\(#nl-badge-frame\) \.clear-host-badge \{/);
    expect(css).toMatch(/html:has\(#nl-badge-frame\) \.above-host-badge \{/);
  });

  it("the mobile buy bar, the Squish Box jump button and the footer use it", () => {
    expect(read("src/components/shop/ProductShowcase.tsx")).toContain('"clear-host-badge fixed inset-x-0 bottom-0');
    expect(read("src/components/box/SquishBoxBuilder.tsx")).toContain('className="above-host-badge fixed bottom-4');
    expect(read("src/components/layout/SiteFooter.tsx")).toContain('className="clear-host-badge');
  });
});
