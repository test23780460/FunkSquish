import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  checkFormToken,
  checkSession,
  hashIdentifier,
  hashPassphrase,
  issueFormToken,
  issueSession,
  readSession,
  verifyPassphrase,
} from "@/lib/partners/security";
import { PASSPHRASE_HASH, partnerSetup, reviewConfig } from "@/lib/partners/config";
import { SECRET } from "./helpers";

describe("form tokens", () => {
  const t0 = 1_800_000_000_000;
  it("accepts a token after a few seconds, rejects instant, old, forged and foreign ones", () => {
    const token = issueFormToken(SECRET, t0);
    expect(checkFormToken(SECRET, token, t0 + 500)).toBe("too-fast");
    expect(checkFormToken(SECRET, token, t0 + 10_000)).toBe("ok");
    expect(checkFormToken(SECRET, token, t0 + 3 * 3600_000)).toBe("expired");
    expect(checkFormToken("another-secret-xxxxxxxxxxxxxxxxxxxxxxx", token, t0 + 10_000)).toBe("invalid");
    const [iat, nonce, sig] = token.split(".");
    expect(checkFormToken(SECRET, `${Number(iat) - 100}.${nonce}.${sig}`, t0 + 10_000)).toBe("invalid");
    expect(checkFormToken(SECRET, "", t0)).toBe("invalid");
  });
});

describe("review sessions and passphrase", () => {
  const hashA = "scrypt:16384:8:1:aaaaaaaaaaaaaaaaaaaaaa:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hashB = "scrypt:16384:8:1:bbbbbbbbbbbbbbbbbbbbbb:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  it("sessions expire, can't be forged, and end when the passphrase changes", () => {
    const now = Date.now();
    const s = issueSession(SECRET, hashA, now);
    expect(checkSession(SECRET, hashA, s, now + 1000)).toBe(true);
    expect(checkSession(SECRET, hashA, s, now + 9 * 3600_000)).toBe(false);
    expect(checkSession(SECRET, hashB, s, now + 1000)).toBe(false);
    expect(checkSession(SECRET, hashA, s.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now)).toBe(false);
    expect(checkSession(SECRET, hashA, undefined)).toBe(false);
    const [exp, v, aal, mfa, epoch, n, sig] = s.split(".");
    expect(checkSession(SECRET, hashA, `${Number(exp) + 999999}.${v}.${aal}.${mfa}.${epoch}.${n}.${sig}`, now)).toBe(false);
    // Upgrading a passphrase-only session to "second step done" (or rewinding the sign-out counter) breaks the signature.
    expect(checkSession(SECRET, hashA, `${exp}.${v}.2.${mfa}.${epoch}.${n}.${sig}`, now)).toBe(false);
    const later = issueSession(SECRET, hashA, now, { aal: 1, mfa: "0", epoch: 3 });
    const p = later.split(".");
    expect(checkSession(SECRET, hashA, [p[0], p[1], p[2], p[3], "2", p[5], p[6]].join("."), now)).toBe(false);
    // The old 4-part format is no longer accepted.
    expect(checkSession(SECRET, hashA, `${exp}.${v}.${n}.${sig}`, now)).toBe(false);
  });

  it("session claims round-trip", () => {
    const now = Date.now();
    const s = issueSession(SECRET, hashA, now, { aal: 2, mfa: "abcDEF123_-x", epoch: 7 }, 600);
    expect(readSession(SECRET, hashA, s, now)).toMatchObject({ aal: 2, mfa: "abcDEF123_-x", epoch: 7 });
    expect(readSession(SECRET, hashA, s, now + 601_000)).toBeNull();
    expect(() => issueSession(SECRET, hashA, now, { aal: 2, mfa: "has.dot", epoch: 0 })).toThrow();
  });

  it("hashes and verifies passphrases (wrong ones fail)", async () => {
    const hash = await hashPassphrase("correct horse battery staple", 16384);
    expect(hash).toMatch(PASSPHRASE_HASH);
    expect(await verifyPassphrase("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassphrase("correct horse battery stapler", hash)).toBe(false);
    expect(await verifyPassphrase("", hash)).toBe(false);
    expect(await verifyPassphrase("x".repeat(500), hash)).toBe(false);
  });

  it("identifier hashes don't contain the IP", () => {
    const h = hashIdentifier(SECRET, "ip", "203.0.113.9");
    expect(h).not.toContain("203");
    expect(h).toBe(hashIdentifier(SECRET, "ip", "203.0.113.9"));
    expect(h).not.toBe(hashIdentifier(SECRET, "email", "203.0.113.9"));
  });
});

describe("integration gate", () => {
  const full = {
    PARTNER_APPLICATIONS_ENABLED: "true",
    PARTNER_SECRET: SECRET,
    PARTNER_REVIEW_PASSPHRASE_HASH: "scrypt:32768:8:1:aaaaaaaaaaaaaaaaaaaaaa:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    PARTNER_NOTIFY_EMAIL: "travis@funksquish.com",
    PARTNER_NOTIFY_FROM: "travis@funksquish.com",
    BREVO_API_KEY: "x",
    BUILD_CONTEXT: "deploy-preview",
  } as unknown as NodeJS.ProcessEnv;

  it("opens only when storage, notification and review login are all configured", () => {
    expect(partnerSetup(full).ready).toBe(true);
    expect(partnerSetup(full).config?.storeSuffix).toBe("-preview");
    for (const key of Object.keys(full)) {
      const env = { ...full, [key]: "" } as NodeJS.ProcessEnv;
      expect(partnerSetup(env).ready, `without ${key}`).toBe(false);
    }
    expect(partnerSetup({ ...full, PARTNER_SECRET: "short" } as NodeJS.ProcessEnv).missing).toContain("PARTNER_SECRET");
  });

  it("keeps production data apart and never uses memory storage outside local dev", () => {
    expect(partnerSetup({ ...full, BUILD_CONTEXT: "production" } as NodeJS.ProcessEnv).config?.storeSuffix).toBe("");
    expect(partnerSetup({ ...full, BUILD_CONTEXT: "", NODE_ENV: "production", PARTNER_DEV_MEMORY_STORE: "true" } as NodeJS.ProcessEnv).ready).toBe(false);
    expect(partnerSetup({ ...full, BUILD_CONTEXT: "", NODE_ENV: "development", PARTNER_DEV_MEMORY_STORE: "true" } as NodeJS.ProcessEnv).config?.storage).toBe("memory");
  });

  it("review needs the login secrets but not the public switch", () => {
    expect(reviewConfig({ ...full, PARTNER_APPLICATIONS_ENABLED: "" } as NodeJS.ProcessEnv)).not.toBeNull();
    expect(reviewConfig({ ...full, PARTNER_REVIEW_PASSPHRASE_HASH: "plaintext-password" } as NodeJS.ProcessEnv)).toBeNull();
  });
});
