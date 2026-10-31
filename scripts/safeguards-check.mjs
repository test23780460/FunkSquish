#!/usr/bin/env node
/**
 * Pre-launch safeguards, checked on every pull request. Fails if a change
 * switches on purchasing, partner applications or email sign-ups, weakens the
 * Stripe locks or the owner two-step sign-in gates, or publishes a draft policy.
 *
 * THIS IS MEANT TO FAIL ON A LAUNCH PR. When the owner approves turning
 * something on, that PR updates EXPECTED below in the same change, so the
 * switch is explicit and reviewed (docs/CI.md, "Launch PRs").
 *
 * Every file a check reads is REQUIRED: deleting a lock's file (or the file
 * that enforces it) fails the check instead of silently skipping it.
 *
 * Usage: node scripts/safeguards-check.mjs [repo-root]   (default: current directory)
 */
import fs from "node:fs";
import path from "node:path";

const EXPECTED = {
  features: { commerce: false, checkoutMode: "disabled", newsletter: false, dropAlerts: false, partnerApplications: false },
  draftPolicies: ["privacy", "terms"],
};

const ROOT = path.resolve(process.argv[2] ?? process.cwd());
const problems = [];
const checked = [];
const read = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), "utf8") : null);
/** A file a safeguard depends on. Missing = the safeguard was removed: fail, never skip. */
const required = (f, what) => {
  const text = read(f);
  if (text === null) problems.push(`${f} is missing (${what}) — a launch safeguard can't be removed by deleting its file`);
  return text ?? "";
};

// 1. Launch switches (src/lib/features.ts)
const features = required("src/lib/features.ts", "launch switches");
if (features) {
  // The values, not the type annotation: everything after "export const features ... = {".
  const start = features.indexOf("export const features");
  const block = features.slice(features.indexOf("= {", start));
  for (const [key, want] of Object.entries(EXPECTED.features)) {
    const m = new RegExp(`\\n\\s*${key}:\\s*("?[\\w-]+"?)`).exec(block);
    const got = m ? m[1].replace(/"/g, "") : "(not found)";
    if (got !== String(want)) problems.push(`features.${key} is ${got}, expected ${want}`);
  }
}
checked.push("launch switches off");

// 2. Stripe locks
{
  const env = required("src/commerce/checkout/environment.ts", "Stripe test/live locks");
  const must = [
    ['if (context === "production" || context === "branch-deploy") return false;', "test mode can't run on production or branch deploys"],
    ['if (isLiveKey(secretKey)) return { ok: false, problem: "live-key-rejected" };', "test mode rejects live keys"],
    ['if (!codeSwitchOn) return { ok: false, problem: "code-switch-off" };', "live mode needs the code switch"],
    ['if (deployContext(env) !== "production") return { ok: false, problem: "environment-not-allowed" };', "live mode only on production"],
    ['if (env.STRIPE_LIVE_CHECKOUT_ENABLED !== "true") return { ok: false, problem: "switch-off" };', "live mode needs its env switch"],
    ['return { ok: false, problem: "test-key-rejected" };', "live mode rejects test keys"],
    ['return { ok: false, problem: "missing-webhook-secret" };', "live mode needs a webhook secret"],
  ];
  if (env) for (const [text, what] of must) if (!env.includes(text)) problems.push(`Stripe lock changed or missing: ${what}`);
  const live = required("src/commerce/checkout/live.ts", "live code switch");
  if (live && !live.includes('features.commerce && features.checkoutMode === "hosted-checkout"')) problems.push("live code switch changed (live.ts)");
  // Verified, owner-approved shipping rates (PR #21).
  required("src/commerce/shipping-approval.ts", "verified, owner-approved shipping rates");
  if (env && !env.includes("const shipping = liveShippingProblem(origins, env.STRIPE_LIVE_SHIPPING_TABLE);"))
    problems.push("Stripe lock changed or missing: live mode needs verified, owner-approved shipping rates");
  checked.push("Stripe test/live locks");
}

// 2b. Owner two-step sign-in gates real orders and partner applications (PR #18).
{
  required("src/lib/owner/mfa-gate.ts", "owner two-step sign-in gate");
  const service = required("src/commerce/checkout/service.ts", "checkout service");
  const partners = required("src/app/actions/partners.ts", "partner application action");
  if (!/if \(!\(await ownerReadyFor\(mode\)\)\) return \{ ok: false, error: "Checkout isn't open yet\." \};/.test(service))
    problems.push("live checkout no longer waits for owner two-step sign-in (service.ts)");
  if (!/const mfa = await ownerMfaReady\(\);\s*if \(!mfa\.ready\)/.test(partners)) problems.push("partner applications no longer wait for owner two-step sign-in (actions/partners.ts)");
  checked.push("two-step sign-in gates");
}

// 2c. Live checkout waits for Stripe to confirm the key's permissions (Disputes: Read).
// Required: deleting key-permissions.ts together with its call in service.ts must FAIL here.
{
  const perms = required("src/commerce/checkout/key-permissions.ts", "live Stripe key permission check");
  const service = read("src/commerce/checkout/service.ts") ?? "";
  if (!/\{ label: "Disputes: Read", probe: \(stripe\) => stripe\.disputes\.list\(\{ limit: 1 \}\) \}/.test(perms))
    problems.push("live checkout no longer requires the Disputes: Read permission (key-permissions.ts)");
  if (!/const keys = await keyPermissionsReady\(config\.secretKey, createStripeLiveClient\(config\)\);[\s\S]{0,200}return keys\.ready;/.test(service))
    problems.push("live checkout no longer waits for the Stripe key permission check (service.ts)");
  checked.push("live key permissions");
}

{
  const stripe = required("src/commerce/checkout/stripe.ts", "cards-only checkout");
  if (!/PAYMENT_METHOD_TYPES[^=]*=\s*\["card"\]/.test(stripe)) problems.push('Checkout must stay cards-only (PAYMENT_METHOD_TYPES = ["card"])');
  if (/allow_promotion_codes|payment_method_configuration|customer_creation:\s*"always"/.test(stripe)) problems.push("Checkout session gained a setting that needs owner/policy review (promotion codes, payment-method configuration or saved customers)");
  checked.push("cards-only checkout");
}

// 3. Draft policies stay drafts (noindex + Draft banner)
{
  const policies = required("src/content/policies.ts", "policy draft status");
  for (const id of EXPECTED.draftPolicies) {
    const page = required(`src/app/${id}/page.tsx`, `${id} draft page`);
    if (page && !/noindex:\s*true/.test(page)) problems.push(`/${id} must stay noindex while it's a draft`);
    if (policies) {
      const m = new RegExp(`${id}:\\s*\\{[^}]*status:\\s*"([\\w-]+)"`).exec(policies);
      if (!m) problems.push(`${id} policy status not found in src/content/policies.ts`);
      else if (m[1] !== "draft") problems.push(`${id} policy status is ${m[1]}, expected draft`);
    }
  }
  checked.push("draft policies");
}

// 4. Owner area stays private
{
  const next = required("next.config.ts", "owner area headers");
  if (next && !/X-Robots-Tag[\s\S]{0,80}noindex/.test(next)) problems.push("owner area lost its noindex header (next.config.ts)");
  if (next && !/private, no-store/.test(next)) problems.push("owner area lost its no-store header (next.config.ts)");
  checked.push("owner area headers");
}

if (problems.length) {
  console.error("Launch safeguards check FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("If this PR is an approved launch change, update EXPECTED in scripts/safeguards-check.mjs in the same PR (docs/CI.md).");
  process.exit(1);
}
console.log(`Launch safeguards check passed: ${checked.join(", ")}.`);
