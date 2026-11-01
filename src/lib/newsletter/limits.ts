import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { deployStorage } from "@/lib/partners/config";
import { partnerStores, takeRateLimits } from "@/lib/partners/store";
import { clientIp } from "@/lib/partners/security";

/**
 * Sign-up limits for the public email forms (launch list, drop alerts).
 * Each accepted sign-up makes Brevo send a confirmation email, so without a
 * limit a script could use the form to send mail to any address. Counts per
 * network (a keyed hash of the IP — never the IP itself) and in total.
 * Uses the same private rate-limit store as partner applications, or an
 * in-memory counter where no store is configured (local development).
 */
export const SIGNUP_LIMITS = { perNetworkPerHour: 5, perNetworkPerDay: 12, totalPerHour: 300 } as const;

const salt = (globalThis as { __fsSignupSalt?: string }).__fsSignupSalt ??= randomBytes(16).toString("hex");
const memory = globalThis as { __fsSignupCounts?: Map<string, { n: number; until: number }> };

function networkHash(ip: string): string {
  const key = process.env.PARTNER_SECRET && process.env.PARTNER_SECRET.length >= 32 ? process.env.PARTNER_SECRET : salt;
  return createHmac("sha256", key).update(`signup-ip:${ip}`).digest("base64url").slice(0, 22);
}

function memoryTake(keys: { key: string; max: number; windowSeconds: number }[], nowMs: number): boolean {
  const m = (memory.__fsSignupCounts ??= new Map());
  for (const k of keys) {
    const c = m.get(k.key);
    if (c && c.until > nowMs && c.n >= k.max) return false;
  }
  for (const k of keys) {
    const c = m.get(k.key);
    if (!c || c.until <= nowMs) m.set(k.key, { n: 1, until: nowMs + k.windowSeconds * 1000 });
    else c.n++;
  }
  return true;
}

/** True if this sign-up may go ahead. Fails open only for local development without storage. */
export async function takeSignup(kind: "newsletter" | "drop-alerts", headers: Pick<Headers, "get">, nowMs = Date.now()): Promise<boolean> {
  const net = networkHash(clientIp(headers as Headers));
  const limits = [
    { key: `signup/${kind}/net/${net}`, max: SIGNUP_LIMITS.perNetworkPerHour, windowSeconds: 3600 },
    { key: `signup/${kind}/net-day/${net}`, max: SIGNUP_LIMITS.perNetworkPerDay, windowSeconds: 86_400 },
    { key: `signup/${kind}/all`, max: SIGNUP_LIMITS.totalPerHour, windowSeconds: 3600 },
  ];
  const storage = deployStorage();
  if (!storage) return memoryTake(limits, nowMs);
  try {
    return await takeRateLimits((await partnerStores(storage)).limits, limits, nowMs);
  } catch {
    // Storage trouble: fall back to this instance's own counter rather than letting everything through.
    return memoryTake(limits, nowMs);
  }
}
