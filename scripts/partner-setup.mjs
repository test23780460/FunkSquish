#!/usr/bin/env node
// Partner applications: create the two secret values for Netlify.
//
//   npm run partners:setup
//
//   npm run partners:setup -- --netlify     (saves both straight to Netlify
//                                            Deploy Previews as secrets; prints nothing secret)
//
// Run this YOURSELF in your own terminal. It asks for a review passphrase
// (typed hidden, twice) and prints:
//   PARTNER_REVIEW_PASSPHRASE_HASH  - a one-way scrypt hash of your passphrase
//   PARTNER_SECRET                  - a new random 256-bit secret
// Paste both into Netlify > Environment variables, marked "Contains secret
// values". Nothing is saved to disk, sent anywhere, or written to the repo.
// Never share the passphrase or these values in chat, email or GitHub.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scrypt = promisify(scryptCb);

// `npm run partners:setup -- --netlify` (Deploy Previews) or `-- --netlify=production`:
// saves both values straight into Netlify (linked site) instead of printing them.
const flag = process.argv.find((a) => a === "--netlify" || a.startsWith("--netlify="));
const netlifyContext = flag ? (flag.split("=")[1] || "deploy-preview") : null;
if (netlifyContext && !["deploy-preview", "production", "branch-deploy"].includes(netlifyContext)) {
  console.error("--netlify must be deploy-preview, production or branch-deploy.");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

// --generate: create a strong random passphrase and save it ONLY to a file in the
// git-ignored private/ folder (never printed). Copy it to your password manager.
const generate = process.argv.includes("--generate");
const PASS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "private", "partner-review-passphrase.txt");

let first;
if (generate) {
  const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
  const groups = Array.from({ length: 5 }, () => Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join(""));
  first = groups.join("-");
  fs.mkdirSync(path.dirname(PASS_FILE), { recursive: true });
  fs.writeFileSync(
    PASS_FILE,
    `FunkSquish partner review passphrase (${netlifyContext ?? "not saved to Netlify"}), created ${new Date().toISOString().slice(0, 10)}\n` +
      `Sign in at /partners/review with:\n\n${first}\n\n` +
      "Move it into your password manager, then delete this file. Never share it in chat, email or GitHub.\n",
    { mode: 0o600 },
  );
  console.log("Generated a passphrase and saved it to private/partner-review-passphrase.txt (git-ignored, not printed).");
} else {
  first = await askHidden("Choose a review passphrase (at least 14 characters, e.g. four random words): ");
  if (first.length < 14) {
    console.error("Too short. Use at least 14 characters.");
    process.exit(1);
  }
  const second = await askHidden("Type it again: ");
  if (first !== second) {
    console.error("The two entries didn't match. Nothing was created.");
    process.exit(1);
  }
}

const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const key = await scrypt(first.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 128 * N * r * 2 });
const hash = `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
const secret = randomBytes(32).toString("base64url");

if (netlifyContext) {
  // Send both values straight to Netlify as secret variables. They are never printed.
  for (const [name, value] of [["PARTNER_REVIEW_PASSPHRASE_HASH", hash], ["PARTNER_SECRET", secret]]) {
    const r = spawnSync(
      "npx",
      ["netlify", "env:set", name, value, "--secret", "--context", netlifyContext, "--scope", "builds", "functions", "runtime"],
      { shell: process.platform === "win32", stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(`Couldn't save ${name} to Netlify: ${String(r.stderr ?? "").split(value).join("[hidden]").trim().slice(0, 300)}`);
      process.exit(1);
    }
    console.log(`Saved ${name} to Netlify (${netlifyContext}, secret).`);
  }
  console.log("\nDone. Keep your passphrase in your password manager. Changing it later (by running this again) signs out every device.");
} else {
  console.log("\nAdd these two to Netlify (Site configuration > Environment variables), each marked 'Contains secret values':\n");
  console.log(`PARTNER_REVIEW_PASSPHRASE_HASH=${hash}`);
  console.log(`PARTNER_SECRET=${secret}`);
  console.log("\nKeep your passphrase in your password manager. Changing it later (by running this again) signs out every device.");
}
