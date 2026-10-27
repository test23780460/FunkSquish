import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { renderPage, timeCommitments, visibleText } from "./render";
import { APPROVED_TIME_COMMITMENTS } from "./approved-commitments";
import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";
import Shipping from "@/app/shipping/page";
import Returns from "@/app/returns/page";
import OrderHelp from "@/app/order-help/page";
import Faq from "@/app/faq/page";
import ProductCare from "@/app/product-care/page";
import Partners from "@/app/partners/page";
import Home from "@/app/page";
import Contact from "@/app/contact/page";
import OurStory from "@/app/our-story/page";
import Drops from "@/app/drops/page";
import TikTokLive from "@/app/tiktok-live/page";
import Shop from "@/app/shop/page";
import { POLICIES } from "@/content/policies";
import { RETENTION } from "@/lib/partners/retention";
import { STANDARD_PROCESSING_BUSINESS_DAYS } from "@/commerce/sales-terms";
import { INDEXABLE_PATHS, NOINDEX_PATHS } from "@/lib/indexing";
import { metadata as privacyMeta } from "@/app/privacy/page";
import { metadata as termsMeta } from "@/app/terms/page";
import { metadata as shippingMeta } from "@/app/shipping/page";
import { metadata as returnsMeta } from "@/app/returns/page";

/**
 * Checks what customers will actually read: each page is rendered to HTML and
 * tested as text. Complements policy-facts.test.ts (which checks the code
 * against the policies).
 */
const POLICY_PAGES = { privacy: Privacy, terms: Terms, shipping: Shipping, returns: Returns, orderHelp: OrderHelp, faq: Faq, productCare: ProductCare, partners: Partners };
type PageKey = keyof typeof POLICY_PAGES;

const html = {} as Record<PageKey, string>;
const text = {} as Record<PageKey, string>;
for (const [k, P] of Object.entries(POLICY_PAGES)) {
  html[k as PageKey] = await renderPage(P as never);
  text[k as PageKey] = visibleText(html[k as PageKey]);
}

describe("drafts stay drafts; approved policies show their version date", () => {
  it("Privacy and Terms render the Draft banner, are noindex and are recorded as drafts", () => {
    for (const [k, meta] of [["privacy", privacyMeta], ["terms", termsMeta]] as const) {
      expect(text[k]).toContain("Draft — not yet in effect");
      expect(text[k]).toContain(`Working draft, last edited ${POLICIES[k].lastUpdated}`);
      expect(meta.robots).toMatchObject({ index: false });
      expect(POLICIES[k].status).toBe("draft");
      expect(NOINDEX_PATHS[POLICIES[k].path]).toBeDefined();
    }
  });

  it("Shipping and Returns render without the Draft banner, are indexable and show the recorded date", () => {
    for (const [k, meta] of [["shipping", shippingMeta], ["returns", returnsMeta]] as const) {
      expect(text[k]).not.toContain("Draft — not yet in effect");
      expect(text[k]).toContain(`Last updated ${POLICIES[k].lastUpdated}`);
      expect(meta.robots).toBeUndefined();
      expect(POLICIES[k].status).toBe("owner-approved");
      expect((INDEXABLE_PATHS as readonly string[]).includes(POLICIES[k].path)).toBe(true);
    }
  });

  it("version strings are real dates matching the displayed date", () => {
    for (const p of Object.values(POLICIES)) {
      expect(p.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const shown = new Date(`${p.lastUpdated} 12:00 UTC`).toISOString().slice(0, 10);
      expect(shown, p.title).toBe(p.version);
    }
  });
});

describe("links in policies and help pages work", () => {
  const routeExists = (path: string) => {
    if ((INDEXABLE_PATHS as readonly string[]).includes(path === "/" ? "" : path) || path in NOINDEX_PATHS) return true;
    return existsSync(join(process.cwd(), "src", "app", ...path.split("/").filter(Boolean), "page.tsx"));
  };
  const ALLOWED_EXTERNAL = /^https:\/\/(www\.)?(funksquish\.com|cpsc\.gov|saferproducts\.gov|tiktok\.com)(\/|$)/;

  for (const k of Object.keys(POLICY_PAGES) as PageKey[]) {
    it(`${k}: every link points at a real page, our email, or an approved site`, () => {
      const hrefs = [...html[k].matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        if (href.startsWith("mailto:")) expect(href).toMatch(/^mailto:travis@funksquish\.com(\?|$)/);
        else if (href.startsWith("#")) continue;
        else if (href.startsWith("/")) expect(routeExists(href.split(/[?#]/)[0]), `${k} links to missing page ${href}`).toBe(true);
        else expect(href, `${k} links to an unreviewed site`).toMatch(ALLOWED_EXTERNAL);
      }
    });
  }

  it("Terms link to and incorporate the Shipping and Returns policies, and link the Privacy notice", () => {
    for (const path of ["/shipping", "/returns", "/privacy", "/product-care"]) expect(html.terms).toContain(`href="${path}"`);
    expect(text.terms).toMatch(/Shipping Policy and Returns & Refunds Policy are part of these Terms/);
    expect(text.terms).toMatch(/versions of these Terms and our Shipping and Returns policies in effect when you placed it/);
    expect(text.terms).toMatch(/never to orders you've already placed/);
  });
});

describe("time commitments are only the approved ones", () => {
  for (const k of Object.keys(POLICY_PAGES) as PageKey[]) {
    it(`${k}`, () => {
      expect(timeCommitments(text[k]), `update tests/legal/approved-commitments.ts (and get approval) for ${k}`).toEqual(Object.keys(APPROVED_TIME_COMMITMENTS[k]).sort());
    });
  }

  it("the code's numbers match what the pages say", () => {
    expect(STANDARD_PROCESSING_BUSINESS_DAYS).toBe(2);
    expect(RETENTION.rateLimitHours / 24).toBe(2);
    expect(RETENTION.deletionRequestDays).toBe(30);
    for (const k of ["privacy", "partners"] as const) {
      expect(text[k]).toContain(`${RETENTION.declinedMonths} months`);
      expect(text[k]).toContain(`${RETENTION.openMonths} months`);
    }
    expect(text.privacy).toContain(`${RETENTION.deletionRecordMonths} months`);
  });
});

describe("no contradictory commitments", () => {
  it("the 7-day damage window is always a preference, never a cutoff", () => {
    for (const k of Object.keys(POLICY_PAGES) as PageKey[]) {
      for (const m of text[k].matchAll(/7 days of delivery/g)) {
        const before = text[k].slice(Math.max(0, m.index - 40), m.index);
        expect(before, `${k}: "...${before}7 days of delivery" reads like a hard deadline`).toMatch(/ideally|preferably/i);
      }
    }
    expect(text.returns).toMatch(/Reporting later than 7 days, or without a photo, doesn't take away your rights/);
  });

  it("refund deadlines agree across pages and match owner decision R7", () => {
    expect(text.returns).toMatch(/within 5 business days after we receive the return/);
    expect(text.returns).toMatch(/refund within 5 business days after we approve the claim/);
    expect(text.returns).toMatch(/Canceled or unshipped orders: refunded promptly, and within 7 business days at the latest/);
    expect(text.shipping).toMatch(/within 7 business days at the latest/);
    for (const k of Object.keys(POLICY_PAGES) as PageKey[]) expect(text[k], k).not.toMatch(/receive and check/);
  });

  it("canceling an unshipped order is a full refund everywhere", () => {
    expect(text.returns).toMatch(/hasn't shipped yet, we'll cancel it and issue a full refund, including shipping and tax/);
    expect(text.orderHelp).toMatch(/refund you in full, including shipping and tax/);
    expect(text.terms).toMatch(/If we cancel an entire order, we refund the entire order, including shipping and tax/);
  });

  it("delay handling follows the FTC Mail Order Rule structure", () => {
    expect(text.shipping).toMatch(/before the ship-by date/);
    expect(text.shipping).toMatch(/no more than 30 days after the original ship-by date and you don't reply/);
    expect(text.shipping).toMatch(/ship only within 30 days after the original ship-by date unless you tell us/);
    expect(text.shipping).toMatch(/If we miss a new date we gave you, we'll ask you again/);
    expect(text.shipping).toMatch(/We never hold your payment for an order we can't fill/);
  });

  it("territories and freely associated states are excluded consistently", () => {
    for (const place of ["Puerto Rico", "Guam", "U.S. Virgin Islands", "American Samoa", "Northern Mariana Islands", "Marshall Islands", "Micronesia", "Palau"])
      expect(text.shipping).toContain(place);
    expect(text.shipping).toMatch(/Washington, D\.C\./);
    expect(text.faq).toMatch(/Washington, D\.C\./);
    expect(text.shipping).toMatch(/we'll cancel that order and promptly refund it in full/);
  });

  it("statutory rights are preserved wherever voluntary terms are set", () => {
    expect(text.returns).toMatch(/Nothing in this policy limits any rights you have under applicable consumer protection laws/);
    expect(text.returns).toMatch(/doesn't restrict, the remedies you have by law/);
    expect(text.shipping).toMatch(/A carrier claim is never a condition of any right you have by law/);
    expect(text.terms).toMatch(/can't be waived/);
    expect(text.terms).toMatch(/you can always dispute a charge with your card issuer/);
  });

  it("final sale is only claimed where the product page discloses it", () => {
    expect(text.returns).toMatch(/only when the product page says "Final sale once opened" before you buy/);
  });

  it("drop alerts never promise a per-product restock email", () => {
    const form = readFileSync(join(process.cwd(), "src/components/drops/DropAlertForm.tsx"), "utf8");
    expect(form).not.toMatch(/including if \$\{productName\} becomes available/);
    expect(form).toMatch(/We don't track individual products/);
    expect(text.privacy).toMatch(/we don't record which product you were looking at/);
  });
});

describe("partner notice and privacy policy say the same, accurate thing", () => {
  it("doesn't imply the email address isn't stored", () => {
    expect(text.partners).not.toMatch(/never storing the addresses themselves/);
    expect(text.partners).toMatch(/your email address is stored with your application/);
    expect(text.privacy).toMatch(/email address you type into the form is, of course, stored/);
  });

  it("qualifies confidentiality and the 30-day deletion promise", () => {
    expect(text.partners).toMatch(/share them only with our professional advisers or when the law requires it/);
    expect(text.privacy).toMatch(/share them only with our professional advisers or when the law requires it/);
    expect(text.partners).toMatch(/within 30 days — unless the law requires us to keep it or it's part of an active legal dispute/);
  });
});

describe("customer-facing pages make no absolute safety, security or compliance claims", () => {
  const BANNED = /\b(100% safe|completely safe|perfectly safe|non-?toxic|certified safe|guaranteed safe|safety guaranteed|fully compliant|COPPA[- ]compliant|GDPR[- ]compliant|CPSC[- ]approved|CPSC[- ]certified|FDA[- ]approved|lab[- ]certified|unhackable|never be (hacked|breached)|exactly once|free shipping on)\b/i;

  it("in policies and help pages", () => {
    for (const k of Object.keys(POLICY_PAGES) as PageKey[]) expect(text[k], k).not.toMatch(BANNED);
  });

  it("on the rest of the site", async () => {
    for (const [name, P] of Object.entries({ Home, Contact, OurStory, Drops, TikTokLive, Shop })) {
      const t = visibleText(await renderPage(P as never));
      expect(t.length, name).toBeGreaterThan(200);
      expect(t, name).not.toMatch(BANNED);
    }
  });

  it("'guarantee' only ever appears as a denial", () => {
    for (const k of Object.keys(POLICY_PAGES) as PageKey[]) {
      for (const m of text[k].matchAll(/guarantee/gi)) {
        const around = text[k].slice(Math.max(0, m.index - 30), m.index + 20);
        expect(around, `${k}: "${around}"`).toMatch(/not a guarantee|don't guarantee|no guarantee/i);
      }
    }
  });
});
