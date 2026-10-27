import "server-only";
import { randomBytes } from "node:crypto";
import { MemoryKvStore, createBlobsKvStore, updateWithRetry, type KvStore } from "@/lib/storage/kv";
import { rateLimitKey } from "./retention";
import { STORE_NAMES } from "./store-names";
import type { PartnerConfig } from "./config";
import type { PartnerInput } from "./validate";
import type { PartnerApplication } from "./types";
import type { Stage } from "./schema";

export interface PartnerStores {
  apps: KvStore;
  limits: KvStore;
  /** Retention run reports and deletion-request records (no applicant contact details). */
  ops: KvStore;
}

const memory = globalThis as { __fsPartnerStores?: PartnerStores };


/** Private stores. Production and previews use different store names. */
export async function partnerStores(cfg: Pick<PartnerConfig, "storage" | "storeSuffix">): Promise<PartnerStores> {
  if (cfg.storage === "memory") {
    memory.__fsPartnerStores ??= { apps: new MemoryKvStore(), limits: new MemoryKvStore(), ops: new MemoryKvStore() };
    return memory.__fsPartnerStores;
  }
  const [apps, limits, ops] = await Promise.all(STORE_NAMES.map((n) => createBlobsKvStore(`${n}${cfg.storeSuffix}`)));
  return { apps, limits, ops };
}

/* ------------------------------ rate limits ------------------------------ */

export interface Limit {
  key: string;
  max: number;
  windowSeconds: number;
}

/**
 * Fixed-window counters. Checks every limit first, then counts the attempt
 * against all of them, so a blocked request doesn't use up other windows.
 */
export async function takeRateLimits(store: KvStore, limits: Limit[], nowMs = Date.now()): Promise<boolean> {
  const keyed = limits.map((l) => ({ ...l, bucketKey: rateLimitKey(l.key, l.windowSeconds, nowMs) }));
  for (const l of keyed) {
    const current = await store.get<{ n: number }>(l.bucketKey);
    if ((current?.value.n ?? 0) >= l.max) return false;
  }
  for (const l of keyed) {
    const { changed } = await updateWithRetry<{ n: number }>(store, l.bucketKey, (c) => ((c?.n ?? 0) >= l.max ? undefined : { n: (c?.n ?? 0) + 1 }));
    if (!changed) return false;
  }
  return true;
}

/* ------------------------------ applications ------------------------------ */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusion

function newId(now: Date) {
  const bytes = randomBytes(8);
  const suffix = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `FS-P-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${suffix}`;
}

export const ID_PATTERN = /^FS-P-\d{8}-[A-Z2-9]{8}$/;
const key = (id: string) => `app/${id}`;

export async function createApplication(store: KvStore, input: PartnerInput, ipHash: string, now = new Date()): Promise<PartnerApplication> {
  for (let i = 0; i < 5; i++) {
    const at = now.toISOString();
    const app: PartnerApplication = {
      id: newId(now),
      createdAt: at,
      updatedAt: at,
      type: input.type,
      status: "new",
      fields: input.fields,
      consent: { version: input.consentVersion, at },
      audit: { ipHash },
      notification: { status: "pending" },
      notes: [],
      history: [{ at, from: null, to: "new" }],
    };
    if (await store.create(key(app.id), app)) return app;
  }
  throw new Error("Could not allocate an application id");
}

export async function getApplication(store: KvStore, id: string) {
  if (!ID_PATTERN.test(id)) return null;
  return (await store.get<PartnerApplication>(key(id)))?.value ?? null;
}

export async function listApplications(store: KvStore): Promise<PartnerApplication[]> {
  const keys = await store.list("app/");
  const apps = await Promise.all(keys.map(async (k) => (await store.get<PartnerApplication>(k))?.value));
  return apps.filter((a): a is PartnerApplication => !!a).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateApplication(store: KvStore, id: string, fn: (app: PartnerApplication) => PartnerApplication | undefined) {
  if (!ID_PATTERN.test(id)) return null;
  const { value } = await updateWithRetry<PartnerApplication>(store, key(id), (current) => {
    if (!current) return undefined;
    const next = fn(current);
    return next ? { ...next, updatedAt: new Date().toISOString() } : undefined;
  });
  return value;
}

export function withStatus(app: PartnerApplication, to: Stage, note?: string): PartnerApplication {
  const at = new Date().toISOString();
  const next = { ...app, notes: [...app.notes], history: [...app.history] };
  if (to !== app.status) {
    next.history.push({ at, from: app.status, to });
    next.status = to;
  }
  if (note?.trim()) next.notes.push({ at, text: note.trim().slice(0, 2000) });
  return next;
}

export async function deleteApplication(store: KvStore, id: string) {
  if (!ID_PATTERN.test(id)) return;
  await store.delete(key(id));
}

