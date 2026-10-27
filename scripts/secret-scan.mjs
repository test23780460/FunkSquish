#!/usr/bin/env node
/**
 * Secret scan for every file tracked by git (run in CI before anything is
 * installed). Fails if anything looks like a real credential. Prints only the
 * file, line and kind of secret — never the value itself.
 *
 * Test fixtures are allowed when they are obviously fake (contain "FAKE",
 * "LOCALQA" or the RFC test key), so tests can exercise key validation.
 * GitHub's own secret scanning and push protection should also be on
 * (docs/CI.md) — this is a second net that also catches non-partner formats.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const RULES = [
  ["Stripe live key", /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{16,}/g],
  ["Stripe test key", /\b(?:sk|rk)_test_[A-Za-z0-9]{16,}/g],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{20,}/g],
  ["Brevo API key", /\bxkeysib-[a-f0-9]{40,}-[A-Za-z0-9]{8,}/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/g],
  ["Netlify token", /\bnfp_[A-Za-z0-9]{30,}/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/g],
  ["Private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/g],
  ["Owner passphrase hash", /\bscrypt:\d+:\d+:\d+:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{32,}/g],
  ["Authenticator secret", /otpauth:\/\/totp\/[^\s"'`]*secret=[A-Z2-7]{16,}/g],
];

/** Obviously fake test values. */
const ALLOWED = [/FAKE/, /LOCALQA/, /GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/ /* RFC 6238 test key */, /:(A{16,}|a{16,}|b{16,}):/];
const SKIP = [/^package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|mp4|webm)$/i];

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const problems = [];

for (const f of files) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)) problems.push(`${f}: an .env file is committed`);
  if (SKIP.some((r) => r.test(f))) continue;
  let text;
  try {
    const stat = fs.statSync(f);
    if (!stat.isFile() || stat.size > 2_000_000) continue;
    text = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue; // binary
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [name, re] of RULES) {
      for (const m of line.matchAll(re)) {
        if (ALLOWED.some((a) => a.test(m[0]))) continue;
        problems.push(`${f}:${i + 1}: possible ${name} (${m[0].slice(0, 6)}…)`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Secret scan: ${problems.length} problem(s). Remove the value, rotate it in the provider's dashboard, and keep secrets in Netlify environment variables.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`Secret scan: ${files.length} tracked files, nothing that looks like a real credential.`);
