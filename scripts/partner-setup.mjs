#!/usr/bin/env node
// Partner applications: create the two secret values for Netlify.
//
//   npm run partners:setup
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

const scrypt = promisify(scryptCb);

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

const first = await askHidden("Choose a review passphrase (at least 14 characters, e.g. four random words): ");
if (first.length < 14) {
  console.error("Too short. Use at least 14 characters.");
  process.exit(1);
}
const second = await askHidden("Type it again: ");
if (first !== second) {
  console.error("The two entries didn't match. Nothing was created.");
  process.exit(1);
}

const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const key = await scrypt(first.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 128 * N * r * 2 });
const hash = `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
const secret = randomBytes(32).toString("base64url");

console.log("\nAdd these two to Netlify (Site configuration > Environment variables), each marked 'Contains secret values':\n");
console.log(`PARTNER_REVIEW_PASSPHRASE_HASH=${hash}`);
console.log(`PARTNER_SECRET=${secret}`);
console.log("\nKeep your passphrase in your password manager. Changing it later (by running this again) signs out every device.");
