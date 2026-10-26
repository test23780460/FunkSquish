import type { RunReport } from "./cleanup";

/**
 * Emails the owner when the retention cleanup needs attention: a failed or
 * partial run, deletion requests that are due soon or overdue, or (on
 * Mondays) approved relationships due for their yearly review. Counts only —
 * no names, emails, references or answers. Sent through Brevo transactional
 * email, like new-application notifications.
 */
export function alertReasons(r: RunReport, now = new Date()): string[] {
  const reasons: string[] = [];
  if (r.status !== "ok") reasons.push(`The cleanup run ${r.status === "failed" ? "failed" : "only partly finished"} (${r.errors.slice(0, 3).join(", ") || "no details"}).`);
  if (r.deletionRequests.overdue) reasons.push(`${r.deletionRequests.overdue} deletion request(s) are past their 30-day deadline.`);
  if (r.deletionRequests.dueSoon) reasons.push(`${r.deletionRequests.dueSoon} deletion request(s) are due within 7 days.`);
  if (r.applications.reviewOverdue && now.getUTCDay() === 1) reasons.push(`${r.applications.reviewOverdue} approved partner record(s) are due for their yearly review.`);
  return reasons;
}

export async function sendOpsAlert(r: RunReport, env: Record<string, string | undefined>, reviewUrl: string, now = new Date()) {
  const reasons = alertReasons(r, now);
  if (!reasons.length) return "not-needed";
  const { PARTNER_NOTIFY_EMAIL: to, PARTNER_NOTIFY_FROM: from, BREVO_API_KEY: key } = env;
  if (!to || !from || !key) return "not-configured";
  const items = reasons.map((x) => `<li>${x.replace(/[<>&]/g, "")}</li>`).join("");
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "FunkSquish website", email: from },
        to: [{ email: to }],
        subject: "Partner data cleanup needs your attention",
        htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c"><h2>Partner data cleanup</h2><ul>${items}</ul><p><a href="${reviewUrl}">Open the private review area</a> (sign-in required).</p></body></html>`,
        tags: ["partner-retention"],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "sent" : `failed-${res.status}`;
  } catch (err) {
    return `failed-${(err as Error)?.name ?? "error"}`;
  }
}
