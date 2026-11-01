import { createHash } from "node:crypto";
import type Stripe from "stripe";

/**
 * Stripe permissions the restricted key must have before LIVE checkout opens.
 *
 * A permission belongs to the key in Stripe, not to any setting here, so the
 * only way to know is to ask Stripe. Each check is a harmless read (one list
 * call, limit 1); nothing it returns is kept or shown. Test mode is never
 * blocked by this: previews keep working with the sandbox key as it is.
 *
 * Why Disputes: Read: when Stripe sends conflicting dispute updates, the order
 * is settled by reading the current Dispute (src/commerce/orders/fulfill.ts).
 * Without the permission that read fails and disputes fall back to event times
 * and "check it in Stripe" — fine for a sandbox, not good enough for real money.
 *
 * Fails closed: a missing permission, a rejected key or Stripe being
 * unreachable all keep live checkout shut. Passing answers are reused for 10
 * minutes per server instance, failures for 1 minute (unreachable isn't
 * reused), so shoppers don't cause a Stripe call per click.
 */
type StripeLike = Pick<Stripe, "disputes">;

export const REQUIRED_KEY_PERMISSIONS: readonly { label: string; probe: (stripe: StripeLike) => Promise<unknown> }[] = [
  { label: "Disputes: Read", probe: (stripe) => stripe.disputes.list({ limit: 1 }) },
];

export type KeyPermissions =
  | { ready: true }
  | { ready: false; reason: "missing-permission"; missing: string[] }
  | { ready: false; reason: "key-rejected" }
  | { ready: false; reason: "stripe-unreachable" };

function classify(err: unknown): "missing" | "key-rejected" | "unreachable" {
  const e = (err ?? {}) as { type?: string; code?: string; statusCode?: number };
  if (e.code === "more_permissions_required" || e.type === "StripePermissionError" || e.statusCode === 403) return "missing";
  if (e.type === "StripeAuthenticationError" || e.statusCode === 401) return "key-rejected";
  return "unreachable";
}

/** Asks Stripe now (no cache). Never throws. */
export async function checkKeyPermissions(stripe: StripeLike): Promise<KeyPermissions> {
  const missing: string[] = [];
  for (const p of REQUIRED_KEY_PERMISSIONS) {
    try {
      await p.probe(stripe);
    } catch (err) {
      const kind = classify(err);
      if (kind === "key-rejected") return { ready: false, reason: "key-rejected" };
      if (kind === "unreachable") return { ready: false, reason: "stripe-unreachable" };
      missing.push(p.label);
    }
  }
  return missing.length ? { ready: false, reason: "missing-permission", missing } : { ready: true };
}

const PASS_MS = 10 * 60_000;
const FAIL_MS = 60_000;
/** Keyed by a hash of the key, so a new key is checked afresh and the key itself is never kept. */
const cache = globalThis as { __fsKeyPermissions?: Map<string, { at: number; result: KeyPermissions }> };
const keyId = (secretKey: string) => createHash("sha256").update(secretKey).digest("hex").slice(0, 16);

export function rememberKeyPermissions(secretKey: string, result: KeyPermissions, nowMs = Date.now()) {
  if (!result.ready && result.reason === "stripe-unreachable") return;
  (cache.__fsKeyPermissions ??= new Map()).set(keyId(secretKey), { at: nowMs, result });
}

/** The gate live checkout uses: cached as described above. */
export async function keyPermissionsReady(secretKey: string, stripe: StripeLike, nowMs = Date.now()): Promise<KeyPermissions> {
  const hit = cache.__fsKeyPermissions?.get(keyId(secretKey));
  if (hit && nowMs - hit.at < (hit.result.ready ? PASS_MS : FAIL_MS)) return hit.result;
  const result = await checkKeyPermissions(stripe);
  rememberKeyPermissions(secretKey, result, nowMs);
  return result;
}

/** Tests. */
export function forgetKeyPermissions() {
  cache.__fsKeyPermissions = undefined;
}

/** Owner-facing explanation (logs, Orders page). Contains no key material. */
export function keyPermissionsText(result: KeyPermissions): string {
  if (result.ready) return "the Stripe key has every permission live checkout needs";
  if (result.reason === "missing-permission")
    return `the Stripe key is missing ${result.missing.join(", ")} (Stripe Dashboard → Developers → API keys → edit the restricted key)`;
  if (result.reason === "key-rejected") return "Stripe rejected the key (revoked, rolled or mistyped)";
  return "Stripe couldn't be reached to check the key's permissions";
}
