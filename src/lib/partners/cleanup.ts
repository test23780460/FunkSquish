import { updateWithRetry, type KvStore } from "../storage/kv-core";
import { RETENTION, rateLimitExpired, retentionDecision } from "./retention";
import { deletionRecordExpired, deletionState, type DeletionRequest } from "./deletion";
import type { PartnerApplication } from "./types";

/**
 * Daily retention cleanup (Netlify scheduled function, or the owner's
 * "Run cleanup now" button). Safe to run any number of times: it only ever
 * deletes records whose retention date has passed, re-checks each record just
 * before deleting it, carries on past individual failures and records a
 * report with counts only — never names, emails, answers or storage keys.
 * Relative imports only, and no "server-only": the Netlify function bundles this file.
 */
export interface CleanupStores {
  apps: KvStore;
  limits: KvStore;
  ops: KvStore;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  trigger: "schedule" | "owner" | "test";
  dryRun: boolean;
  status: "ok" | "partial" | "failed";
  applications: { checked: number; due: number; deleted: number; kept: number; held: number; reviewOverdue: number; failed: number };
  rateLimits: { checked: number; due: number; deleted: number; failed: number };
  deletionRequests: { open: number; dueSoon: number; overdue: number; exceptions: number; recordsPurged: number };
  /** Short, non-sensitive error codes such as "applications:list:StorageTimeoutError". */
  errors: string[];
}

export const RUN_LAST = "run/last";
export const RUN_LAST_SUCCESS = "run/last-success";
const RUN_HISTORY = "run/history/";

const code = (where: string, err: unknown) => `${where}:${(err as Error)?.name || "Error"}`;

/** Unconditional write on top of the compare-and-set store. */
export async function put<T>(store: KvStore, key: string, value: T) {
  await updateWithRetry<T>(store, key, () => value);
}

export async function runRetention(stores: CleanupStores, opts: { now?: Date; dryRun?: boolean; trigger?: RunReport["trigger"] } = {}): Promise<RunReport & { dueRefs: string[] }> {
  const now = opts.now ?? new Date();
  const dryRun = !!opts.dryRun;
  const report: RunReport = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    trigger: opts.trigger ?? "schedule",
    dryRun,
    status: "ok",
    applications: { checked: 0, due: 0, deleted: 0, kept: 0, held: 0, reviewOverdue: 0, failed: 0 },
    rateLimits: { checked: 0, due: 0, deleted: 0, failed: 0 },
    deletionRequests: { open: 0, dueSoon: 0, overdue: 0, exceptions: 0, recordsPurged: 0 },
    errors: [],
  };
  // References that are (or would be) deleted. Returned to the signed-in owner only; never stored or logged.
  const dueRefs: string[] = [];

  // 1. Applications
  try {
    for (const key of await stores.apps.list("app/")) {
      report.applications.checked++;
      try {
        const app = (await stores.apps.get<PartnerApplication>(key))?.value;
        if (!app) continue;
        const d = retentionDecision(app, now);
        if (d.action === "hold") report.applications.held++;
        if (d.action === "review" && d.overdue) report.applications.reviewOverdue++;
        if (d.action !== "delete") {
          report.applications.kept++;
          continue;
        }
        report.applications.due++;
        dueRefs.push(app.id);
        if (dryRun) continue;
        // Re-check right before deleting, in case the owner just changed it.
        const fresh = (await stores.apps.get<PartnerApplication>(key))?.value;
        if (!fresh || retentionDecision(fresh, now).action !== "delete") {
          report.applications.kept++;
          continue;
        }
        await stores.apps.delete(key);
        report.applications.deleted++;
      } catch (err) {
        report.applications.failed++;
        report.errors.push(code("applications:item", err));
      }
    }
  } catch (err) {
    report.errors.push(code("applications:list", err));
    report.status = "failed";
  }

  // 2. Rate-limit counters (keys only; their values are just counts)
  try {
    for (const key of await stores.limits.list("")) {
      report.rateLimits.checked++;
      if (!rateLimitExpired(key, now)) continue;
      report.rateLimits.due++;
      if (dryRun) continue;
      try {
        await stores.limits.delete(key);
        report.rateLimits.deleted++;
      } catch (err) {
        report.rateLimits.failed++;
        report.errors.push(code("rate-limits:item", err));
      }
    }
  } catch (err) {
    report.errors.push(code("rate-limits:list", err));
    report.status = "failed";
  }

  // 3. Deletion requests: deadlines, and purge old closed records
  try {
    for (const key of await stores.ops.list("deletion/")) {
      try {
        const req = (await stores.ops.get<DeletionRequest>(key))?.value;
        if (!req) continue;
        const state = deletionState(req, now);
        if (state === "open" || state === "due-soon" || state === "overdue") report.deletionRequests.open++;
        if (state === "due-soon") report.deletionRequests.dueSoon++;
        if (state === "overdue") report.deletionRequests.overdue++;
        if (state === "exception") report.deletionRequests.exceptions++;
        if (deletionRecordExpired(req, now)) {
          if (!dryRun) await stores.ops.delete(key);
          report.deletionRequests.recordsPurged++;
        }
      } catch (err) {
        report.errors.push(code("deletion-requests:item", err));
      }
    }
  } catch (err) {
    report.errors.push(code("deletion-requests:list", err));
    report.status = "failed";
  }

  if (report.status !== "failed" && report.errors.length) report.status = "partial";
  report.finishedAt = new Date().toISOString();
  return { ...report, dueRefs };
}

/** Saves the report (without references). Dry runs never count as a successful cleanup. */
export async function recordRun(ops: KvStore, report: RunReport) {
  const clean: RunReport = { ...report, errors: report.errors.slice(0, 20) };
  delete (clean as Partial<RunReport & { dueRefs: unknown }>).dueRefs;
  await put(ops, RUN_LAST, clean);
  if (!report.dryRun && report.status === "ok") await put(ops, RUN_LAST_SUCCESS, { at: report.finishedAt });
  await ops.create(`${RUN_HISTORY}${report.startedAt}`, clean);
  const history = await ops.list(RUN_HISTORY);
  for (const key of history.slice(0, Math.max(0, history.length - RETENTION.runHistory))) await ops.delete(key);
}

export async function lastRuns(ops: KvStore) {
  const [last, success] = await Promise.all([ops.get<RunReport>(RUN_LAST), ops.get<{ at: string }>(RUN_LAST_SUCCESS)]);
  return { last: last?.value ?? null, lastSuccessAt: success?.value.at ?? null };
}

/** One line for logs: counts and error codes only. */
export function summarize(r: RunReport) {
  const a = r.applications;
  const l = r.rateLimits;
  const d = r.deletionRequests;
  return (
    `[partners] retention ${r.dryRun ? "DRY RUN " : ""}${r.status}: applications checked=${a.checked} due=${a.due} deleted=${a.deleted} held=${a.held} reviewOverdue=${a.reviewOverdue} failed=${a.failed}; ` +
    `rate-limits checked=${l.checked} deleted=${l.deleted} failed=${l.failed}; deletion-requests open=${d.open} overdue=${d.overdue} purged=${d.recordsPurged}` +
    (r.errors.length ? `; errors=${r.errors.slice(0, 5).join(",")}` : "")
  );
}
