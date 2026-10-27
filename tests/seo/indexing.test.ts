import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import nextConfig from "../../next.config";
import { CANONICAL_ORIGIN, INDEXABLE_PATHS, NETLIFY_PRODUCTION_HOST, NOINDEX_PATHS } from "@/lib/indexing";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { listProducts } from "@/commerce/catalog";

const APP = join(process.cwd(), "src", "app");

/** Every page route in src/app, e.g. "/shop/[slug]" (route groups and private folders skipped). */
function pageRoutes(dir = APP): { route: string; source: string }[] {
  const out: { route: string; source: string }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!name.startsWith("_")) out.push(...pageRoutes(full));
    } else if (name === "page.tsx") {
      const parts = relative(APP, dir).split(sep).filter((p) => p && !/^\(.*\)$/.test(p));
      out.push({ route: parts.length ? `/${parts.join("/")}` : "", source: readFileSync(full, "utf8") });
    }
  }
  return out;
}

const noindexIn = (source: string) => /noindex:\s*true|index:\s*false/.test(source);

describe("indexing rules", () => {
  it("uses one canonical origin everywhere", () => {
    expect(CANONICAL_ORIGIN).toBe("https://funksquish.com");
    expect(siteConfig.url).toBe(CANONICAL_ORIGIN);
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(layout).toMatch(/metadataBase:\s*new URL\(siteConfig\.url\)/);
    // A canonical in the root layout would wrongly apply to every page.
    expect(layout).not.toMatch(/canonical/);
  });

  it("classifies every page as indexable or deliberately noindex", () => {
    const routes = pageRoutes();
    expect(routes.length).toBeGreaterThan(10);
    for (const { route } of routes) {
      if (route === "/shop/[slug]") continue; // decided per product, tested below
      const known = (INDEXABLE_PATHS as readonly string[]).includes(route) || route in NOINDEX_PATHS;
      expect(known, `${route || "/"} must be listed in src/lib/indexing.ts`).toBe(true);
    }
    for (const path of [...INDEXABLE_PATHS, ...Object.keys(NOINDEX_PATHS)]) {
      expect(routes.some((r) => r.route === path), `${path} is listed but has no page`).toBe(true);
    }
  });

  it("indexable pages declare their own canonical and never noindex", () => {
    for (const { route, source } of pageRoutes()) {
      if (!(INDEXABLE_PATHS as readonly string[]).includes(route)) continue;
      expect(noindexIn(source), `${route} is in the sitemap but marked noindex`).toBe(false);
      const canonical = route === "" ? /canonical:\s*"\/"/ : new RegExp(`path:\\s*"${route}"`);
      expect(source, `${route || "/"} should set its canonical`).toMatch(canonical);
    }
  });

  it("noindex pages really carry noindex", () => {
    for (const { route, source } of pageRoutes()) {
      if (route in NOINDEX_PATHS) expect(noindexIn(source), `${route} should be noindex`).toBe(true);
    }
  });

  it("pageMetadata sets a relative canonical (resolved against the canonical origin) and noindex,follow when asked", () => {
    const m = pageMetadata({ title: "T", description: "D", path: "/faq" });
    expect(m.alternates?.canonical).toBe("/faq");
    expect(m.robots).toBeUndefined();
    expect(pageMetadata({ title: "T", description: "D", path: "/terms", noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});

describe("robots.txt", () => {
  it("allows crawling and blocks nothing", async () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const rule of rules) {
      expect(rule.allow).toBe("/");
      // Blocking a noindex page hides the noindex tag from Google ("Indexed, though blocked by robots.txt").
      expect(rule.disallow ?? []).toEqual([]);
    }
    expect(r.sitemap).toBe(`${CANONICAL_ORIGIN}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("lists only canonical, indexable URLs, once each", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith(CANONICAL_ORIGIN), url).toBe(true);
      const u = new URL(url);
      expect(u.search + u.hash, url).toBe("");
      expect(url.endsWith("/"), `${url} should not end with a slash`).toBe(false);
      expect(u.pathname in NOINDEX_PATHS, `${url} is noindex`).toBe(false);
    }
    for (const path of INDEXABLE_PATHS) expect(urls).toContain(`${CANONICAL_ORIGIN}${path}`);
  });

  it("never lists illustrated preview products", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    const previews = (await listProducts()).filter((p) => p.publication === "preview");
    expect(previews.length).toBeGreaterThan(0);
    for (const p of previews) expect(urls).not.toContain(`${CANONICAL_ORIGIN}/shop/${p.slug}`);
  });
});

describe("headers and redirects", () => {
  it("only the private review area and calendar downloads send X-Robots-Tag", async () => {
    const headers = (await nextConfig.headers?.()) ?? [];
    const robotsRules = headers.filter((h) => h.headers.some((x) => x.key.toLowerCase() === "x-robots-tag"));
    expect(robotsRules.map((h) => h.source).sort()).toEqual(["/partners/review", "/partners/review/:path*", "/tiktok-live/calendar/:id"]);
  });

  it("redirects the production Netlify subdomain (only) to the canonical domain", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toHaveLength(1);
    const [r] = redirects;
    expect(r.permanent).toBe(true);
    expect(r.destination).toBe(`${CANONICAL_ORIGIN}/:path*`);
    const host = r.has?.find((h) => h.type === "host");
    const re = new RegExp(`^${host?.value}$`);
    expect(re.test(NETLIFY_PRODUCTION_HOST)).toBe(true);
    for (const other of ["funksquish.com", "deploy-preview-10--ephemeral-syrniki-2b3f3c.netlify.app", "ephemeral-syrniki-2b3f3cXnetlify.app", "localhost:3000"]) expect(re.test(other), other).toBe(false);
  });
});
