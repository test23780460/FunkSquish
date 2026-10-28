#!/usr/bin/env node
/**
 * Pre-launch safeguards, checked on every pull request. Fails if a change
 * switches on purchasing, partner applications or email sign-ups, weakens the
 * Stripe locks or the owner two-step sign-in gates, or publishes a draft policy.
 *
 * THIS IS MEANT TO FAIL ON A LAUNCH PR. When the owner approves turning
 * something on, that PR updates EXPECTED below in the same change, so the
 * switch is explicit and reviewed (docs/CI.md, "Launch PRs").
 * Checks only what exists on the branch: files a branch doesn't have yet
 * (e.g. the Stripe code on main today) are skipped.
 */
import fs from "node:fs";

const EXPECTED = {
  features: { commerce: false, checkoutMode: "disabled", newsletter: false, dropAlerts: false, partnerApplications: false },
  draftPolicies: ["privacy", "terms"],
};

const problems = [];
const checked = [];
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);

// 1. Launch switches (src/lib/features.ts)
const features = read("src/lib/features.ts");
if (!features) problems.push("src/lib/features.ts is missing");
else {
  // The values, not the type annotation: everything after "export const features ... = {".
  const start = features.indexOf("export const features");
  const block = features.slice(features.indexOf("= {", start));
  for (const [key, want] of Object.entries(EXPECTED.features)) {
    const m = new RegExp(`\\n\\s*${key}:\\s*("?[\\w-]+"?)`).exec(block);
    const got = m ? m[1].replace(/"/g, "") : "(not found)";
    if (got !== String(want)) problems.push(`features.${key} is ${got}, expected ${want}`);
  }
  checked.push("launch switches off");
}

// 2. Stripe locks (only where the Stripe code exists)
const env = read("src/commerce/checkout/environment.ts");
if (env) {
  const must = [
    ['if (context === "production" || context === "branch-deploy") return false;', "test mode can't run on production or branch deploys"],
    ['if (isLiveKey(secretKey)) return { ok: false, problem: "live-key-rejected" };', "test mode rejects live keys"],
    ['if (!codeSwitchOn) return { ok: false, problem: "code-switch-off" };', "live mode needs the code switch"],
    ['if (deployContext(env) !== "production") return { ok: false, problem: "environment-not-allowed" };', "live mode only on production"],
    ['if (env.STRIPE_LIVE_CHECKOUT_ENABLED !== "true") return { ok: false, problem: "switch-off" };', "live mode needs its env switch"],
    ['return { ok: false, problem: "test-key-rejected" };', "live mode rejects test keys"],
    ['return { ok: false, problem: "missing-webhook-secret" };', "live mode needs a webhook secret"],
  ];
  for (const [text, what] of must) if (!env.includes(text)) problems.push(`Stripe lock changed or missing: ${what}`);
  const live = read("src/commerce/checkout/live.ts");
  if (live && !live.includes('features.commerce && features.checkoutMode === "hosted-checkout"')) problems.push("live code switch changed (live.ts)");
  // Verified, owner-approved shipping rates (PR #21), once that code exists on the branch.
  if (read("src/commerce/shipping-approval.ts") && !env.includes("const shipping = liveShippingProblem(origins, env.STRIPE_LIVE_SHIPPING_TABLE);"))
    problems.push("Stripe lock changed or missing: live mode needs verified, owner-approved shipping rates");
  checked.push("Stripe test/live locks");
}

// 2b. Owner two-step sign-in gates real orders and partner applications (PR #18), once that code exists.
if (read("src/lib/owner/mfa-gate.ts")) {
  const service = read("src/commerce/checkout/service.ts") ?? "";
  const partners = read("src/app/actions/partners.ts") ?? "";
  if (!/if \(!\(await ownerReadyFor\(mode\)\)\) return \{ ok: false, error: "Checkout isn't open yet\." \};/.test(service))
    problems.push("live checkout no longer waits for owner two-step sign-in (service.ts)");
  if (!/const mfa = await ownerMfaReady\(\);\s*if \(!mfa\.ready\)/.test(partners)) problems.push("partner applications no longer wait for owner two-step sign-in (actions/partners.ts)");
  checked.push("two-step sign-in gates");
}
const stripe = read("src/commerce/checkout/stripe.ts");
if (stripe) {
  if (!/PAYMENT_METHOD_TYPES[^=]*=\s*\["card"\]/.test(stripe)) problems.push('Checkout must stay cards-only (PAYMENT_METHOD_TYPES = ["card"])');
  if (/allow_promotion_codes|payment_method_configuration|customer_creation:\s*"always"/.test(stripe)) problems.push("Checkout session gained a setting that needs owner/policy review (promotion codes, payment-method configuration or saved customers)");
  checked.push("cards-only checkout");
}

// 3. Draft policies stay drafts (noindex + Draft banner)
const policies = read("src/content/policies.ts");
for (const id of EXPECTED.draftPolicies) {
  const page = read(`src/app/${id}/page.tsx`);
  if (page && !/noindex:\s*true/.test(page)) problems.push(`/${id} must stay noindex while it's a draft`);
  if (policies) {
    const m = new RegExp(`${id}:\\s*\\{[^}]*status:\\s*"([\\w-]+)"`).exec(policies);
    if (m && m[1] !== "draft") problems.push(`${id} policy status is ${m[1]}, expected draft`);
  }
}
checked.push("draft policies");

// 4. Owner area stays private
const next = read("next.config.ts");
if (next && !/X-Robots-Tag[\s\S]{0,80}noindex/.test(next)) problems.push("owner area lost its noindex header (next.config.ts)");
if (next && !/private, no-store/.test(next)) problems.push("owner area lost its no-store header (next.config.ts)");
checked.push("owner area headers");

if (problems.length) {
  console.error("Launch safeguards check FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("If this PR is an approved launch change, update EXPECTED in scripts/safeguards-check.mjs in the same PR (docs/CI.md).");
  process.exit(1);
}
console.log(`Launch safeguards check passed: ${checked.join(", ")}.`);
