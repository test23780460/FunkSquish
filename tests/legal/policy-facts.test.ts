import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps the policy pages honest: if the code starts doing something the
 * policies don't describe (a new analytics event, a new outside service),
 * or a policy drifts back to a claim the system can't keep, this fails.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function sources(dir = join(ROOT, "src")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sources(full) : /\.(tsx?|mts)$/.test(name) ? [readFileSync(full, "utf8")] : [];
  });
}

const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const shipping = read("src/app/shipping/page.tsx");
const partners = read("src/app/partners/page.tsx");
const code = sources().join("\n");

/** Each analytics event and the words the privacy policy uses for it. */
const EVENT_WORDING: Record<string, RegExp> = {
  "tiktok-click": /clicks on our\s+TikTok links/,
  "buy-external": /TikTok links/,
  "quiz-start": /starting or finishing the quiz/,
  "quiz-complete": /starting or finishing the quiz/,
  "box-start": /starting a Squish Box/,
  "wishlist-add": /adding to or sharing a wishlist/,
  "wishlist-share": /adding to or sharing a wishlist/,
  "squish-lab-squish": /using the Squish\s+Lab/,
  "newsletter-signup": /completed email sign-ups/,
  "drop-alert-signup": /completed email sign-ups/,
  "partner-application": /which partner category/,
};

describe("privacy policy matches the code", () => {
  it("describes every analytics event the site sends", () => {
    const events = new Set([...code.matchAll(/trackEvent\("([a-z-]+)"/g), ...code.matchAll(/data-umami-event="([a-z-]+)"/g)].map((m) => m[1]));
    expect(events.size).toBeGreaterThan(5);
    for (const e of events) {
      expect(EVENT_WORDING[e], `analytics event "${e}" isn't mapped to privacy-policy wording`).toBeDefined();
      expect(privacy, `privacy policy doesn't describe "${e}"`).toMatch(EVENT_WORDING[e]);
    }
  });

  it("names every outside service the code talks to", () => {
    const services: [RegExp, string][] = [
      [/cloud\.umami\.is/, "Umami"],
      [/api\.brevo\.com/, "Brevo"],
      [/tiktok\.com/, "TikTok"],
      [/@netlify\/blobs/, "Netlify"],
    ];
    for (const [pattern, name] of services) if (pattern.test(code)) expect(privacy, `${name} is used but not named`).toContain(name);
    expect(privacy).toContain("Stripe");
    expect(privacy).toContain("Google Workspace");
  });

  it("is accurate about the partner IP code being kept with the application", () => {
    const keepsIpHash = /ipHash/.test(read("src/lib/partners/types.ts"));
    expect(keepsIpHash).toBe(true);
    expect(privacy).toMatch(/kept with the\s+application/);
    expect(partners).toMatch(/one IP code is kept with your application/);
    expect(privacy).toMatch(/never store the IP address/);
  });
});

describe("drafts stay drafts", () => {
  for (const [name, src] of [["privacy", privacy], ["terms", terms]] as const) {
    it(`${name} is marked Draft and noindex`, () => {
      expect(src).toMatch(/noindex:\s*true/);
      expect(src).not.toMatch(/draft=\{false\}/);
      expect(src).toMatch(/\(draft\)/);
    });
  }
});

describe("shipping promises the system can keep", () => {
  it("doesn't claim weight-based rates or tracking emails from the checkout provider", () => {
    expect(shipping).not.toMatch(/calculated at checkout from your package/);
    expect(shipping).not.toMatch(/by email from our checkout provider/);
    expect(read("src/app/order-help/page.tsx")).not.toMatch(/from our checkout provider/);
  });

  it("limits the 2-business-day promise to our own stock and covers territories", () => {
    expect(shipping).toMatch(/from our own stock within <strong>2 business days<\/strong>/);
    expect(shipping).toMatch(/territory/);
  });
});
