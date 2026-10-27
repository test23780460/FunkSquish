import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

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
  "buy-external": /clicks on\s+&ldquo;Buy&rdquo; links to TikTok Shop or another store/,
  "quiz-start": /starting or finishing the quiz/,
  "quiz-complete": /starting or finishing the quiz/,
  "box-start": /starting a Squish Box/,
  "wishlist-add": /adding to or sharing a\s+wishlist/,
  "wishlist-share": /adding to or sharing a\s+wishlist/,
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

  it("says analytics strip URL parameters and skip private pages — and the code does", () => {
    const analytics = read("src/components/analytics/Analytics.tsx");
    expect(analytics).toMatch(/data-before-send=\{UMAMI_BEFORE_SEND_NAME\}/);
    expect(analytics).toMatch(/strategy="beforeInteractive"/);
    expect(analytics).toMatch(/data-do-not-track="true"/);
    expect(privacy).toMatch(/only marketing campaign tags/);
    expect(privacy).toMatch(/private owner\s+pages and checkout pages aren&apos;t counted/);
    expect(privacy).toMatch(/don&apos;t run if your browser sends a Do Not Track signal/);
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
    expect(shipping).toMatch(/territories/);
  });
});

describe("checkout can't open without its safeguards", () => {
  it("every purchasing switch is off in this branch", async () => {
    const { features, purchasingEnabled } = await import("@/lib/features");
    expect(features.commerce).toBe(false);
    expect(features.checkoutMode).toBe("disabled");
    expect(purchasingEnabled).toBe(false);
    expect(features.partnerApplications).toBe(false);
  });

  it("no product can be bought and the checkout action refuses", async () => {
    const { listProducts } = await import("@/commerce/catalog");
    const { canPurchase } = await import("@/commerce/availability");
    for (const p of await listProducts()) for (const v of p.variants) expect(canPurchase(p, v)).toBe(false);
    const { startCheckout } = await import("@/app/actions/checkout");
    expect(await startCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
  });

  it("the Terms and Privacy Policy still say checkout isn't open", () => {
    expect(terms).toMatch(/Nothing on the Site is currently offered for sale, and no orders can be placed/);
    expect(privacy).toMatch(/Checkout isn&apos;t open yet/);
  });
});

describe("owner-only areas stay private", () => {
  it("the review area is noindex and never cached", async () => {
    const nextConfig = (await import("../../next.config")).default;
    const rules = (await nextConfig.headers!()) as { source: string; headers: { key: string; value: string }[] }[];
    for (const source of ["/partners/review", "/partners/review/:path*"]) {
      const rule = rules.find((r) => r.source === source);
      expect(rule, source).toBeDefined();
      expect(rule!.headers).toEqual(expect.arrayContaining([{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }]));
    }
  });

  it("review pages return 404 when the review login isn't configured", async () => {
    vi.stubEnv("PARTNER_SECRET", "");
    const pages = [await import("@/app/partners/review/page"), await import("@/app/partners/review/requests/page"), await import("@/app/partners/review/[id]/page")];
    for (const page of pages) {
      const Page = page.default as unknown as (p: unknown) => unknown;
      expect(() => Page({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).toThrow();
    }
    vi.unstubAllEnvs();
  });
});

describe("consent wording matches what the forms do", () => {
  it("the newsletter and drop-alert forms require a ticked consent box, as the policy says", () => {
    for (const f of ["src/components/home/NewsletterForm.tsx", "src/components/drops/DropAlertForm.tsx"]) {
      const form = read(f);
      expect(form, f).toMatch(/type="checkbox" name="consent" value="yes" required/);
      expect(form, f).toMatch(/I can unsubscribe anytime/);
      expect(form, f).toMatch(/href="\/privacy"/);
    }
    for (const a of ["src/app/actions/newsletter.ts", "src/app/actions/drop-alerts.ts"]) expect(read(a), a).toMatch(/formData\.get\("consent"\) !== "yes"/);
    expect(privacy).toMatch(/tick a box agreeing/);
    expect(privacy).toMatch(/double opt-in/);
  });

  it("partner applications store the consent version shown on the form", async () => {
    const { CONSENT_TEXT, CONSENT_VERSION } = await import("@/lib/partners/schema");
    expect(CONSENT_TEXT).toMatch(/privacy notice/);
    expect(CONSENT_TEXT).toMatch(/doesn't sign me up for marketing emails/);
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(read("src/lib/partners/store.ts")).toMatch(/consent: \{ version: input\.consentVersion, at \}/);
  });
});
