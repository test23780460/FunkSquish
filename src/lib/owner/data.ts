import "server-only";
import { randomBytes } from "node:crypto";
import { MemoryKvStore, createBlobsKvStore, type KvStore } from "@/lib/storage/kv";
import { takeRateLimits, type PartnerStores } from "@/lib/partners/store";
import type { PartnerConfig } from "@/lib/partners/config";

/**
 * The owner dashboard's private store ("owner-data", plus "-preview" on
 * deploy previews): products being prepared, suppliers, shipping set-up,
 * and the audit log. Netlify Blobs, private to the site — never served
 * publicly, never in GitHub. In memory for local `next dev` and tests.
 *
 * Production and preview data never mix: the suffix comes from the build's
 * deploy context (src/lib/partners/config.ts), not from anything a request sends.
 */
type StoreCfg = Pick<PartnerConfig, "storage" | "storeSuffix">;
const memory = globalThis as { __fsOwnerDataStore?: MemoryKvStore };

export async function ownerDataStore(cfg: StoreCfg): Promise<KvStore> {
  if (cfg.storage === "memory") return (memory.__fsOwnerDataStore ??= new MemoryKvStore());
  return createBlobsKvStore(`owner-data${cfg.storeSuffix}`);
}

/* --------------------------------- audit log --------------------------------- */

export const AUDIT_AREAS = ["products", "media", "inventory", "orders", "suppliers", "fulfillment", "shipping", "marketing", "settings", "security"] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/**
 * One owner action. Append-only: each entry is its own key, written once
 * (create-only), so concurrent actions never overwrite each other.
 * Holds ids and short descriptions only — never customer names, addresses,
 * emails, supplier prices or secrets.
 */
export interface AuditEntry {
  id: string;
  at: string;
  area: AuditArea;
  action: string;
  /** Product id, supplier id, order number… */
  target: string | null;
  summary: string;
}

const day = (iso: string) => iso.slice(0, 10);
const auditKey = (e: AuditEntry) => `audit/${day(e.at)}/${e.at}~${e.id}`;
/** Anything that looks like an email address or a long number is masked before it's stored. */
export function scrubAuditText(s: string): string {
  return s
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\b\d{9,}\b/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function appendAudit(store: KvStore, entry: Omit<AuditEntry, "id" | "at"> & { at?: string }): Promise<AuditEntry> {
  const e: AuditEntry = {
    id: randomBytes(6).toString("base64url"),
    at: entry.at ?? new Date().toISOString(),
    area: entry.area,
    action: entry.action.slice(0, 60),
    target: entry.target ? entry.target.slice(0, 80) : null,
    summary: scrubAuditText(entry.summary),
  };
  await store.create(auditKey(e), e);
  return e;
}

/** Newest first, from the last `days` days. */
export async function listAudit(store: KvStore, { days = 14, limit = 100, area, now = new Date() }: { days?: number; limit?: number; area?: AuditArea; now?: Date } = {}): Promise<AuditEntry[]> {
  const out: AuditEntry[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const d = day(new Date(now.getTime() - i * 86_400_000).toISOString());
    const keys = (await store.list(`audit/${d}/`)).reverse();
    for (const k of keys) {
      const v = (await (store.getListed ?? store.get).call(store, k)) as { value: AuditEntry } | null;
      if (v && (!area || v.value.area === area)) out.push(v.value);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Remove audit entries older than `keepDays` (default two years). Returns how many were removed. */
export async function pruneAudit(store: KvStore, keepDays = 730, now = new Date()): Promise<number> {
  const cutoff = day(new Date(now.getTime() - keepDays * 86_400_000).toISOString());
  let removed = 0;
  for (const k of await store.list("audit/")) {
    if (k.slice(6, 16) < cutoff) {
      await store.delete(k);
      removed++;
    }
  }
  return removed;
}

/* ------------------------------ action helpers ------------------------------ */

export interface OwnerTools {
  data: KvStore;
  audit(area: AuditArea, action: string, target: string | null, summary: string): Promise<void>;
  /** True if this action may run now; false once the owner area's write budget is used up. */
  allow(bucket: string, max: number, windowSeconds: number): Promise<boolean>;
}

/**
 * What owner server actions use AFTER `requireReviewer()` has confirmed a
 * fully signed-in owner. Every write is rate limited (a stolen session or a
 * stuck script can't hammer storage) and recorded in the audit log.
 */
export async function ownerTools(ctx: { cfg: StoreCfg; stores: PartnerStores }): Promise<OwnerTools> {
  const data = await ownerDataStore(ctx.cfg);
  return {
    data,
    async audit(area, action, target, summary) {
      try {
        await appendAudit(data, { area, action, target, summary });
      } catch {
        console.warn(`[owner] audit write failed (${area}/${action})`); // never block the action on the log
      }
    },
    async allow(bucket, max, windowSeconds) {
      return takeRateLimits(ctx.stores.limits, [
        { key: `owner/${bucket}`, max, windowSeconds },
        { key: "owner/all-writes", max: 600, windowSeconds: 60 * 60 },
      ]);
    },
  };
}
