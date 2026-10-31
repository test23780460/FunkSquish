import "server-only";
import type { KvStore } from "@/lib/storage/kv";

/**
 * Backup and restore for the dashboard's own records (products, suppliers,
 * shipping set-up, catalog releases, settings, activity log). Orders and the
 * stock ledger live in the order stores and have their own exports; product
 * photos are listed by key (download them from the Products page).
 *
 * A backup contains private business data (costs, supplier terms). It is
 * only ever downloaded by the signed-in owner, never cached, and should be
 * kept somewhere private (docs/OWNER-GUIDE.md → Backups).
 */
export const BACKUP_FORMAT = "funksquish-owner-backup";
export const BACKUP_VERSION = 1;
/** Key prefixes included. Rate-limit counters and partner applications are not dashboard data. */
export const BACKUP_PREFIXES = ["product/", "supplier/", "supplier-doc/", "shipping/", "release/", "settings/", "audit/", "marketing/", "restock/"] as const;
const LAST_BACKUP_KEY = "settings/last-backup";

export interface OwnerBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** "production", "preview" or "local" — a preview backup can't be restored into production by accident. */
  environment: string;
  records: Record<string, unknown>;
}

export async function exportOwnerData(store: KvStore, environment: string, now = new Date()): Promise<OwnerBackup> {
  const records: Record<string, unknown> = {};
  for (const prefix of BACKUP_PREFIXES) {
    for (const key of await store.list(prefix)) {
      if (key === LAST_BACKUP_KEY) continue;
      const v = await (store.getListed ?? store.get).call(store, key);
      if (v) records[key] = (v as { value: unknown }).value;
    }
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), environment, records };
}

export async function recordBackup(store: KvStore, now = new Date()): Promise<void> {
  const cur = await store.get<{ at: string }>(LAST_BACKUP_KEY);
  if (cur) await store.replace(LAST_BACKUP_KEY, { at: now.toISOString() }, cur.etag);
  else await store.create(LAST_BACKUP_KEY, { at: now.toISOString() });
}

export async function lastBackup(store: KvStore): Promise<string | null> {
  return (await store.get<{ at: string }>(LAST_BACKUP_KEY))?.value.at ?? null;
}

export type RestorePlan = { ok: true; add: string[]; same: string[]; differ: string[] } | { ok: false; error: string };

const KEY = /^[a-z-]+\/[\w./~:@-]{1,200}$/;

/** Check an uploaded backup and work out what restoring it would change. Writes nothing. */
export async function planRestore(store: KvStore, raw: unknown, environment: string): Promise<RestorePlan> {
  const b = raw as Partial<OwnerBackup> | null;
  if (!b || b.format !== BACKUP_FORMAT || b.version !== BACKUP_VERSION || typeof b.records !== "object" || !b.records)
    return { ok: false, error: "That file isn't a FunkSquish dashboard backup." };
  if (b.environment !== environment) return { ok: false, error: `That backup is from ${b.environment ?? "an unknown place"}, not ${environment}. Restore it there instead.` };
  const add: string[] = [];
  const same: string[] = [];
  const differ: string[] = [];
  for (const [key, value] of Object.entries(b.records)) {
    if (!KEY.test(key) || !BACKUP_PREFIXES.some((p) => key.startsWith(p)) || key === LAST_BACKUP_KEY) return { ok: false, error: `The backup has an unexpected record (${key.slice(0, 40)}).` };
    const cur = await store.get(key);
    if (!cur) add.push(key);
    else if (JSON.stringify(cur.value) === JSON.stringify(value)) same.push(key);
    else differ.push(key);
  }
  return { ok: true, add, same, differ };
}

/**
 * Restore: always adds records that are missing; replaces records that
 * differ only when `overwrite` is true. Never deletes anything.
 */
export async function applyRestore(store: KvStore, backup: OwnerBackup, plan: Extract<RestorePlan, { ok: true }>, overwrite: boolean): Promise<{ added: number; replaced: number }> {
  let added = 0;
  let replaced = 0;
  for (const key of plan.add) if (await store.create(key, backup.records[key])) added++;
  if (overwrite)
    for (const key of plan.differ) {
      const cur = await store.get(key);
      if (cur && (await store.replace(key, backup.records[key], cur.etag))) replaced++;
    }
  return { added, replaced };
}

export function environmentName(cfg: { storage: "blobs" | "memory"; storeSuffix: string }): string {
  if (cfg.storage === "memory") return "local";
  return cfg.storeSuffix ? "preview" : "production";
}
