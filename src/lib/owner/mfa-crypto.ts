import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Protection for the second factor at rest:
 *  - the authenticator secret is encrypted with AES-256-GCM, under a key
 *    derived (HKDF-SHA256) from the server secret PARTNER_SECRET, bound to its
 *    enrollment id — a copy of the storage alone doesn't reveal it;
 *  - recovery codes are stored only as keyed hashes (HMAC-SHA256 with another
 *    derived key). They're random 50-bit codes and every attempt is rate
 *    limited, so a slow password hash isn't needed.
 * Neither value is ever logged.
 */
const SALT = Buffer.from("funksquish-owner-mfa-v1");

function key(serverSecret: string, purpose: "totp" | "recovery"): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(serverSecret), SALT, Buffer.from(purpose), 32));
}

/** iv(12) | ciphertext | tag(16), base64url. */
export function encryptSecret(serverSecret: string, plain: Buffer, boundTo: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(serverSecret, "totp"), iv);
  c.setAAD(Buffer.from(boundTo));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString("base64url");
}

/** Null if tampered with, bound to a different id, or encrypted under another server secret. */
export function decryptSecret(serverSecret: string, sealed: string, boundTo: string): Buffer | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const d = createDecipheriv("aes-256-gcm", key(serverSecret, "totp"), raw.subarray(0, 12));
    d.setAAD(Buffer.from(boundTo));
    d.setAuthTag(raw.subarray(raw.length - 16));
    return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]);
  } catch {
    return null;
  }
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export const RECOVERY_CODE_COUNT = 10;

/** Ten single-use codes like "K7QX2-MNP4R" (about 50 bits each). Shown once, never stored in plain text. */
export function newRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    const bytes = randomBytes(10);
    const s = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function hashRecoveryCode(serverSecret: string, code: string): string {
  return createHmac("sha256", key(serverSecret, "recovery")).update(normalizeRecoveryCode(code)).digest("base64url");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
