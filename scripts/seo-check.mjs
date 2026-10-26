#!/usr/bin/env node
/**
 * Checks what search engines actually receive from a running site.
 *
 *   npm run seo:check                          # production (https://funksquish.com)
 *   npm run seo:check -- http://localhost:3000 # a local `next start`
 *
 * Read-only: it only sends GET requests. Exits 1 if anything is wrong.
 */
import { CANONICAL_ORIGIN, NETLIFY_PRODUCTION_HOST, NOINDEX_PATHS } from "../src/lib/indexing.ts";

const base = (process.argv[2] ?? CANONICAL_ORIGIN).replace(/\/$/, "");
const isProduction = base === CANONICAL_ORIGIN;
const problems = [];
let checks = 0;

const ok = (cond, msg) => {
  checks++;
  if (!cond) problems.push(msg);
  return cond;
};

async function get(path, { redirect = "follow" } = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${base}${path}`, { redirect, headers: { "User-Agent": "FunkSquish-seo-check" } });
  const body = redirect === "follow" ? await res.text() : "";
  return { res, body };
}

const metaRobots = (html) => html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "";
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
const noindex = (res, html) => /noindex/i.test(res.headers.get("x-robots-tag") ?? "") || /noindex/i.test(metaRobots(html));
const sameUrl = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

// robots.txt
const robots = await get("/robots.txt");
ok(robots.res.status === 200, `/robots.txt returned ${robots.res.status}`);
const disallows = robots.body.split("\n").filter((l) => /^disallow:\s*\S/i.test(l.trim()));
ok(disallows.length === 0, `robots.txt blocks paths: ${disallows.join(", ")}`);
ok(robots.body.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`), "robots.txt doesn't point at the canonical sitemap");

// sitemap.xml and every page in it
const sm = await get("/sitemap.xml");
ok(sm.res.status === 200, `/sitemap.xml returned ${sm.res.status}`);
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(locs.length > 0, "sitemap.xml lists no URLs");
for (const loc of locs) {
  ok(loc.startsWith(CANONICAL_ORIGIN), `sitemap URL isn't canonical: ${loc}`);
  const path = new URL(loc).pathname.replace(/^\/$/, "");
  ok(!(path in NOINDEX_PATHS), `sitemap lists a noindex page: ${loc}`);
  const { res, body } = await get(path || "/");
  if (!ok(res.status === 200, `${loc} returned ${res.status}`)) continue;
  ok(!noindex(res, body), `${loc} is in the sitemap but marked noindex`);
  ok(sameUrl(canonicalOf(body), loc), `${loc} has canonical ${canonicalOf(body) || "(none)"}`);
}

// Deliberately excluded pages: reachable (not blocked) and carrying noindex, or not found at all.
for (const path of Object.keys(NOINDEX_PATHS).filter((p) => !p.includes("["))) {
  const { res, body } = await get(path);
  if (res.status === 404) continue; // e.g. a feature that isn't deployed or configured here
  ok(res.status === 200, `${path} returned ${res.status}`);
  ok(noindex(res, body), `${path} should be noindex`);
}

// Host and protocol redirects (production only).
if (isProduction) {
  for (const from of ["http://funksquish.com/", "https://www.funksquish.com/", `https://${NETLIFY_PRODUCTION_HOST}/`]) {
    let url = from;
    for (let hop = 0; hop < 4 && url !== `${CANONICAL_ORIGIN}/`; hop++) {
      const { res } = await get(url, { redirect: "manual" });
      if (![301, 308].includes(res.status)) break;
      url = new URL(res.headers.get("location"), url).toString();
    }
    ok(url === `${CANONICAL_ORIGIN}/`, `${from} doesn't permanently redirect to ${CANONICAL_ORIGIN}/ (ended at ${url})`);
  }
}

console.log(`Checked ${base}: ${locs.length} sitemap URLs, ${checks} checks.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("All good.");
