import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226), as used by
 * authenticator apps: HMAC-SHA1, 6 digits, 30-second steps. SHA-1 is what
 * every authenticator app supports for TOTP; its weaknesses don't apply to
 * HMAC. No third-party code.
 */
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
/** Accept the previous and next step too (clock drift of about ±30 s). */
export const TOTP_WINDOW = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding (what authenticator apps expect). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i === -1) throw new Error("Not base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret (RFC 4226 recommends at least 128). */
export function newTotpSecret(): Buffer {
  return randomBytes(20);
}

export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_PERIOD);

export function totpAt(secret: Buffer, nowMs: number, digits = TOTP_DIGITS): string {
  return hotp(secret, stepAt(nowMs), digits);
}

/**
 * Check a code. Returns the matching time step, or null. A step at or below
 * `lastUsedStep` is refused, so a code can't be used twice (replay).
 */
export function verifyTotp(secret: Buffer, code: string, nowMs: number, lastUsedStep: number): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = stepAt(nowMs);
  let match: number | null = null;
  for (let s = now - TOTP_WINDOW; s <= now + TOTP_WINDOW; s++) {
    // Compare every candidate (no early exit) in constant time.
    const ok = timingSafeEqual(Buffer.from(hotp(secret, s)), Buffer.from(clean));
    if (ok && s > lastUsedStep && match === null) match = s;
  }
  return match;
}

/** The link authenticator apps understand (otpauth://). */
export function otpauthUri(secret: Buffer, account = "Owner", issuer = "FunkSquish"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/** "ABCD EFGH …" for typing the key into an app by hand. */
export const groupKey = (b32: string) => b32.replace(/(.{4})/g, "$1 ").trim();
