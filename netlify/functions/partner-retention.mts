/**
 * Daily partner-data retention cleanup (Netlify Scheduled Function).
 *
 * Netlify only runs scheduled functions on the published PRODUCTION deploy and
 * doesn't expose them at a public URL there, so this always works on the
 * production stores and nobody outside can trigger it. Deploy previews are
 * cleaned with the owner's "Run cleanup now" button in /partners/review.
 *
 * PARTNER_RETENTION_DRY_RUN=true makes it report what it would delete without deleting.
 * Logs and the stored report contain counts and error codes only.
 */
import { createBlobsKvStore } from "../../src/lib/storage/kv-core";
import { recordRun, runRetention, summarize, type RunReport } from "../../src/lib/partners/cleanup";
import { sendOpsAlert } from "../../src/lib/partners/ops-alert";
import { STORE_NAMES } from "../../src/lib/partners/store-names";

const REVIEW_URL = "https://funksquish.com/partners/review";

export default async function partnerRetention() {
  const dryRun = process.env.PARTNER_RETENTION_DRY_RUN === "true";
  let report: RunReport;
  try {
    const [apps, limits, ops] = await Promise.all(STORE_NAMES.map((name) => createBlobsKvStore(name)));
    report = await runRetention({ apps, limits, ops }, { dryRun, trigger: "schedule" });
    try {
      await recordRun(ops, report);
    } catch (err) {
      report.errors.push(`report:${(err as Error)?.name ?? "Error"}`);
      if (report.status === "ok") report.status = "partial";
    }
  } catch (err) {
    const now = new Date().toISOString();
    report = {
      startedAt: now,
      finishedAt: now,
      trigger: "schedule",
      dryRun,
      status: "failed",
      applications: { checked: 0, due: 0, deleted: 0, kept: 0, held: 0, reviewOverdue: 0, failed: 0 },
      rateLimits: { checked: 0, due: 0, deleted: 0, failed: 0 },
      deletionRequests: { open: 0, dueSoon: 0, overdue: 0, exceptions: 0, recordsPurged: 0 },
      errors: [`open-storage:${(err as Error)?.name ?? "Error"}`],
    };
  }
  const line = summarize(report);
  if (report.status === "ok") console.log(line);
  else console.error(line);
  const alert = await sendOpsAlert(report, process.env, REVIEW_URL);
  if (alert !== "not-needed") console.log(`[partners] retention alert: ${alert}`);
  return new Response(report.status, { status: report.status === "failed" ? 500 : 200 });
}

// Every day at 08:00 UTC (early morning in Kentucky).
export const config = { schedule: "0 8 * * *" };
