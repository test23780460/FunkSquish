import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, otpauthUri, totpAt, verifyTotp } from "@/lib/owner/totp";
import { decryptSecret, encryptSecret, hashRecoveryCode, newRecoveryCodes, normalizeRecoveryCode } from "@/lib/owner/mfa-crypto";

const RFC_SECRET = Buffer.from("12345678901234567890"); // RFC 4226 / 6238 test key (SHA-1)

describe("TOTP (RFC 6238) and HOTP (RFC 4226)", () => {
  it("matches the RFC 4226 HOTP test values", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, i) => expect(hotp(RFC_SECRET, i)).toBe(code));
  });

  it("matches the RFC 6238 SHA-1 test values (last 6 digits of the 8-digit vectors)", () => {
    for (const [t, code8] of [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ] as const) {
      expect(totpAt(RFC_SECRET, t * 1000, 8)).toBe(code8);
      expect(totpAt(RFC_SECRET, t * 1000)).toBe(code8.slice(2));
    }
  });

  it("accepts ±1 step of clock drift, nothing older or newer, and never the same step twice", () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now, 0)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 30_000), now, 0)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now + 30_000), now, 0)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 90_000), now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now, step)).toBeNull(); // replay
    expect(verifyTotp(RFC_SECRET, "12345", now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now, 0)).toBeNull();
  });

  it("encodes base32 per RFC 4648 (no padding) and round-trips", () => {
    for (const [plain, enc] of [["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]])
      expect(base32Encode(Buffer.from(plain))).toBe(enc);
    expect(base32Decode("mzxw 6ytb-oi").toString()).toBe("foobar");
    expect(otpauthUri(RFC_SECRET)).toBe("otpauth://totp/FunkSquish%3AOwner?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=FunkSquish&algorithm=SHA1&digits=6&period=30");
  });
});

describe("second factor at rest", () => {
  const SERVER = "server-secret-for-tests-0123456789abcdef";
  it("encrypts the authenticator secret, bound to its enrollment, and detects tampering", () => {
    const sealed = encryptSecret(SERVER, RFC_SECRET, "enr1");
    expect(sealed).not.toContain(base32Encode(RFC_SECRET));
    expect(decryptSecret(SERVER, sealed, "enr1")).toEqual(RFC_SECRET);
    expect(decryptSecret(SERVER, sealed, "enr2")).toBeNull();
    expect(decryptSecret("another-server-secret-0123456789abcdef", sealed, "enr1")).toBeNull();
    const raw = Buffer.from(sealed, "base64url");
    raw[14] ^= 1;
    expect(decryptSecret(SERVER, raw.toString("base64url"), "enr1")).toBeNull();
    expect(encryptSecret(SERVER, RFC_SECRET, "enr1")).not.toBe(sealed); // fresh IV each time
  });

  it("makes ten distinct recovery codes and stores only keyed hashes", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    const h = hashRecoveryCode(SERVER, codes[0]);
    expect(h).not.toContain(normalizeRecoveryCode(codes[0]));
    expect(hashRecoveryCode(SERVER, codes[0].toLowerCase().replace("-", " "))).toBe(h); // forgiving input
    expect(hashRecoveryCode("another-server-secret-0123456789abcdef", codes[0])).not.toBe(h);
  });
});
