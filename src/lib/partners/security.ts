import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** Keyed hash with a purpose label, so one secret can't be reused across purposes. */
export function hmac(secret: string, purpose: string, data: string) {
  return createHmac("sha256", secret).update(`${purpose}\u0000${data}`).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ------------------------------ form tokens ------------------------------ */

export const FORM_MIN_SECONDS = 3; // humans take longer than this to fill the form
export const FORM_MAX_SECONDS = 2 * 60 * 60;

export function issueFormToken(secret: string, nowMs = Date.now()) {
  const payload = `${Math.floor(nowMs / 1000)}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${hmac(secret, "form", payload)}`;
}

export function checkFormToken(secret: string, token: string, nowMs = Date.now()): "ok" | "too-fast" | "expired" | "invalid" {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 200) return "invalid";
  const [iat, nonce, sig] = parts;
  if (!safeEqual(sig, hmac(secret, "form", `${iat}.${nonce}`))) return "invalid";
  const age = nowMs / 1000 - Number(iat);
  if (!Number.isFinite(age) || age < -60) return "invalid";
  if (age < FORM_MIN_SECONDS) return "too-fast";
  if (age > FORM_MAX_SECONDS) return "expired";
  return "ok";
}

/* ------------------------------ identifiers ------------------------------ */

/** Keyed, truncated hash: enough to rate-limit and spot abuse, not reversible to the IP. */
export function hashIdentifier(secret: string, kind: "ip" | "email" | "deletion", value: string) {
  return hmac(secret, kind, value.trim().toLowerCase()).slice(0, 22);
}

/* ------------------------------ passphrase ------------------------------ */

/** Format: scrypt:N:r:p:<salt b64url>:<hash b64url> (no "$", so .env loaders can't mangle it). Made by scripts/partner-setup.mjs. */
export async function hashPassphrase(passphrase: string, N = 32768, r = 8, p = 1) {
  const salt = randomBytes(16);
  const key = await scrypt(passphrase.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export async function verifyPassphrase(passphrase: string, stored: string) {
  if (!passphrase || passphrase.length > 200) return false;
  const [scheme, n, r, p, salt, hash] = stored.split(":");
  if (scheme !== "scrypt") return false;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every(Number.isInteger) || N > 2 ** 20 || N < 2 ** 14) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(passphrase.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/* ------------------------------ review sessions ------------------------------ */

export const SESSION_COOKIE = "fs_partner_review";
export const SESSION_SECONDS = 8 * 60 * 60;

/** A session is tied to the current passphrase: changing it signs every device out. */
function passphraseVersion(secret: string, passphraseHash: string) {
  return hmac(secret, "pw-version", passphraseHash).slice(0, 12);
}

export function issueSession(secret: string, passphraseHash: string, nowMs = Date.now()) {
  const payload = `${Math.floor(nowMs / 1000) + SESSION_SECONDS}.${passphraseVersion(secret, passphraseHash)}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${hmac(secret, "session", payload)}`;
}

export function checkSession(secret: string, passphraseHash: string, token: string | undefined, nowMs = Date.now()) {
  if (!token || token.length > 300) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [exp, version, nonce, sig] = parts;
  if (!safeEqual(sig, hmac(secret, "session", `${exp}.${version}.${nonce}`))) return false;
  if (!safeEqual(version, passphraseVersion(secret, passphraseHash))) return false;
  return Number(exp) * 1000 > nowMs;
}

/** Client IP as seen by Netlify's edge (falls back to the first forwarded hop). */
export function clientIp(h: Headers) {
  return h.get("x-nf-client-connection-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
