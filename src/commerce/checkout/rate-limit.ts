import "server-only";
import { randomBytes } from "node:crypto";
import { ConflictError, MemoryKvStore, createBlobsKvStore, type KvStore } from "@/lib/storage/kv";
import { takeRateLimits } from "@/lib/partners/store";
import { hmac } from "@/lib/partners/security";
import { STORE_NAMES } from "@/lib/partners/store-names";

/**
 * Abuse limits for the public checkout endpoints: the cart's shipping quote
 * and "Secure checkout" (which holds stock and creates a Stripe session).
 *
 * Two layers, both per shopper network (never global, so one abuser can't
 * shut checkout for everyone):
 *  1. A per-server-instance burst guard in memory — no storage I/O, so a
 *     flood is stopped before it costs anything.
 *  2. Durable fixed-window counters in the site's rate-limit store, so the
 *     limit holds across server instances.
 *
 * Quotes and checkout starts are counted separately: a shopper who edits
 * their cart a lot can still check out. Limits are far above what a real
 * shopper (or a few shoppers on one home, school or office network) does —
 * see tests/checkout/rate-limit.test.ts.
 *
 * Privacy: the network address is only used in memory and as a keyed,
 * truncated hash (never stored or logged as-is). The counters live in the
 * same store as the partner form's counters, which the daily cleanup empties
 * 2 days after each window starts (src/lib/partners/cleanup.ts).
 */
export type CheckoutRequestKind = "quote" | "start";

interface Window {
  max: number;
  windowSeconds: number;
}

export const CHECKOUT_RATE_LIMITS: Record<CheckoutRequestKind, { burst: Window; windows: Window[] }> = {
  // The cart asks for a quote 250 ms after the shopper stops changing it.
  quote: { burst: { max: 40, windowSeconds: 60 }, windows: [{ max: 150, windowSeconds: 600 }] },
  // Each start holds stock for ~31 minutes, so these are tighter.
  start: {
    burst: { max: 6, windowSeconds: 60 },
    windows: [
      { max: 10, windowSeconds: 1800 },
      { max: 30, windowSeconds: 86_400 },
    ],
  },
};

export const RATE_LIMIT_MESSAGES: Record<CheckoutRequestKind, string> = {
  quote:
    "We couldn't update the shipping estimate just now. Your shipping and total will still be shown on the secure checkout page before you pay.",
  start: "There have been a lot of checkout attempts from your network in a short time. Please wait a few minutes and try again — nothing was charged.",
};

export type RateLimitResult = { ok: true } | { ok: false; message: string };

/* ------------------------------ who is asking ------------------------------ */

/** "a:b:c:d:e:f:g:h" with every group expanded, or null if it isn't IPv6. */
function expandIpv6(ip: string): string[] | null {
  const [head, tail, extra] = ip.split("::");
  if (extra !== undefined) return null;
  const left = head ? head.split(":") : [];
  const right = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 1) return null;
  const groups = [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
  return groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g)) ? groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")) : null;
}

/**
 * The network a request comes from. IPv6 shoppers are grouped by /64 (one
 * home or phone usually gets a whole /64, so per-address limits would be
 * trivially dodged).
 */
export function clientNetwork(h: Pick<Headers, "get">): string {
  // Netlify sets x-nf-client-connection-ip itself. If it's ever missing, the LAST
  // X-Forwarded-For entry is the one our proxy added; earlier ones are client-supplied.
  const raw =
    h.get("x-nf-client-connection-ip")?.trim() ||
    h
      .get("x-forwarded-for")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .at(-1) ||
    "unknown";
  const ip = raw.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  if (ip.includes(":")) {
    const groups = expandIpv6(ip);
    return groups ? `${groups.slice(0, 4).join(":")}::/64` : "unknown-v6";
  }
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) ? ip : "unknown";
}

const mem = globalThis as {
  __fsCheckoutBurst?: Map<string, number[]>;
  __fsCheckoutLimitStore?: MemoryKvStore;
  __fsCheckoutLimitKey?: string;
  __fsCheckoutLimitWarned?: boolean;
};

function hashKey(): { key: string; durable: boolean } {
  const secret = process.env.PARTNER_SECRET ?? "";
  if (secret.length >= 32) return { key: secret, durable: true };
  // Without the site secret, hashes only live in this process's memory.
  mem.__fsCheckoutLimitKey ??= randomBytes(32).toString("base64url");
  return { key: mem.__fsCheckoutLimitKey, durable: false };
}

/* ------------------------------ layer 1: memory ------------------------------ */

/** Most shopper networks one server instance keeps in memory (oldest dropped first). */
export const MAX_TRACKED_CLIENTS = 5_000;

function takeBurst(key: string, w: Window, nowMs: number): boolean {
  const map = (mem.__fsCheckoutBurst ??= new Map<string, number[]>());
  const since = nowMs - w.windowSeconds * 1000;
  const hits = (map.get(key) ?? []).filter((t) => t > since);
  const allowed = hits.length < w.max;
  if (allowed) hits.push(nowMs);
  map.delete(key); // re-insert so the map's order is least-recently-seen first
  map.set(key, hits);
  while (map.size > MAX_TRACKED_CLIENTS) map.delete(map.keys().next().value as string);
  return allowed;
}

/* ------------------------------ layer 2: storage ------------------------------ */

/** The site's rate-limit store (shared with the partner form; emptied by the daily cleanup). */
export const RATE_LIMIT_STORE = STORE_NAMES[1];

async function defaultStore(): Promise<KvStore | null> {
  // BUILD_CONTEXT is frozen at build time (next.config.ts).
  const context = process.env.BUILD_CONTEXT;
  const netlify = context === "production" ? "" : context === "deploy-preview" || context === "branch-deploy" ? "-preview" : null;
  if (netlify === null) return (mem.__fsCheckoutLimitStore ??= new MemoryKvStore());
  if (!hashKey().durable) {
    if (!mem.__fsCheckoutLimitWarned) console.warn("[checkout] PARTNER_SECRET not set: checkout limits are per server instance only");
    mem.__fsCheckoutLimitWarned = true;
    return null;
  }
  return createBlobsKvStore(`${RATE_LIMIT_STORE}${netlify}`);
}

/**
 * Count one checkout request from this shopper's network and say whether it
 * may go ahead. `h` is null outside a web request (tests, scripts), where
 * there is no shopper to limit.
 *
 * A storage outage lets requests through (checkout then fails or succeeds on
 * its own merits); a burst of parallel requests from one network that keeps
 * colliding on its own counter is refused.
 */
export async function checkCheckoutRateLimit(
  kind: CheckoutRequestKind,
  h: Pick<Headers, "get"> | null,
  nowMs = Date.now(),
  store?: KvStore | null,
): Promise<RateLimitResult> {
  if (!h) return { ok: true };
  const limits = CHECKOUT_RATE_LIMITS[kind];
  const refuse = (): RateLimitResult => ({ ok: false, message: RATE_LIMIT_MESSAGES[kind] });
  const network = clientNetwork(h);
  const id = hmac(hashKey().key, "checkout-client", network).slice(0, 22);

  if (!takeBurst(`${kind}/${id}`, limits.burst, nowMs)) return refuse();

  // No usable client address (never expected on Netlify): don't put every such shopper
  // into one shared stored counter, where one abuser could lock out all of them.
  // The per-instance burst guard above still applies.
  if (network.startsWith("unknown")) return { ok: true };

  try {
    const s = store === undefined ? await defaultStore() : store;
    if (!s) return { ok: true };
    const allowed = await takeRateLimits(
      s,
      limits.windows.map((w) => ({ key: `checkout-${kind}/${id}`, ...w })),
      nowMs,
    );
    return allowed ? { ok: true } : refuse();
  } catch (err) {
    if (err instanceof ConflictError) return refuse();
    console.error(`[checkout] rate-limit store unavailable (${(err as Error)?.name ?? "Error"}); request allowed`);
    return { ok: true };
  }
}

/** Tests only: forget the in-memory counters. */
export function resetCheckoutRateLimitMemory() {
  mem.__fsCheckoutBurst = new Map();
  mem.__fsCheckoutLimitStore = new MemoryKvStore();
}
