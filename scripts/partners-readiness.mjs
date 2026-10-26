#!/usr/bin/env node
/**
 * Is the partner application form safe to switch on in production?
 *
 *   npm run partners:readiness
 *
 * Read-only. Checks Netlify variable NAMES and contexts (never values), the
 * live pages, the published privacy wording and that the retention cleanup
 * function is deployed. Legal review can't be checked by a script — it's
 * listed as a manual gate. Exits 1 if any automated check fails.
 */
import { spawnSync } from "node:child_process";

const SITE_ID = "b801770a-90a9-44d9-a053-0048815bff6d";
const ORIGIN = "https://funksquish.com";
const REQUIRED = ["PARTNER_SECRET", "PARTNER_REVIEW_PASSPHRASE_HASH", "PARTNER_NOTIFY_EMAIL", "PARTNER_NOTIFY_FROM", "BREVO_API_KEY"];
const results = [];
const check = (ok, label, detail = "") => results.push({ ok, label, detail });

function netlifyApi(method, data) {
  const r = spawnSync("npx", ["-y", "netlify", "api", method, "--data", JSON.stringify(data)], { encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`netlify api ${method} failed`);
  return JSON.parse(r.stdout);
}

// 1. Production variables (names and contexts only)
let site;
try {
  site = netlifyApi("getSite", { site_id: SITE_ID });
  const vars = netlifyApi("getEnvVars", { account_id: site.account_id, site_id: SITE_ID });
  const inProd = (key) => vars.find((v) => v.key === key)?.values.some((x) => x.context === "production" || x.context === "all");
  for (const key of REQUIRED) check(!!inProd(key), `${key} set for Production`);
  const enabled = !!inProd("PARTNER_APPLICATIONS_ENABLED");
  check(true, `PARTNER_APPLICATIONS_ENABLED for Production: ${enabled ? "SET (form can open)" : "not set (form stays closed)"}`);
} catch (err) {
  check(false, "Read Netlify variables", err.message);
}

// 2. Retention cleanup deployed with the published site
try {
  const deploy = netlifyApi("getDeploy", { deploy_id: site.published_deploy.id });
  const fn = (deploy.available_functions ?? []).find((f) => f.n === "partner-retention");
  check(!!fn, "Retention cleanup function is in the published deploy", fn?.s ? `schedule ${fn.s}` : "");
} catch (err) {
  check(false, "Read the published deploy", err.message);
}

// 3. Live pages
async function page(path) {
  const r = await fetch(ORIGIN + path, { redirect: "manual", headers: { "User-Agent": "FunkSquish-readiness" } });
  return { status: r.status, headers: r.headers, body: await r.text() };
}
const review = await page("/partners/review");
check(review.status === 200, "/partners/review is configured (sign-in page)", `status ${review.status}`);
check(/noindex/.test(review.headers.get("x-robots-tag") ?? ""), "/partners/review sends noindex");
check(/no-store/.test(review.headers.get("cache-control") ?? ""), "/partners/review is never cached");
const requests = await page("/partners/review/requests");
check(requests.status === 200 && /noindex/.test(requests.headers.get("x-robots-tag") ?? ""), "/partners/review/requests is private (noindex)");
const partners = await page("/partners");
check(partners.status === 200, "/partners loads");
check(/deleted automatically/i.test(partners.body) && /within 30 days/i.test(partners.body), "Partner page notice states automatic deletion and the 30-day request deadline");
const privacy = await page("/privacy");
check(/deleted automatically after 2 days/i.test(privacy.body) && /12 months/i.test(privacy.body) && /never approved automatically/i.test(privacy.body), "Privacy policy describes the enforced retention schedule");
const formOpen = /name="type"/.test(partners.body) && !/Online applications open soon/.test(partners.body);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? ` (${r.detail})` : ""}`);
console.log("MANUAL  Legal review of the partner notice, privacy policy and retention schedule (owner confirms — not checkable here)");
console.log(`\nPublic form right now: ${formOpen ? "OPEN" : "closed (email fallback)"}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} automated check(s) failed — keep the form closed.` : "\nAll automated checks pass. Switch the form on only after the manual gate is done.");
process.exit(failed ? 1 : 0);
