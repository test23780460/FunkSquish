import "server-only";
import { PARTNER_TYPES } from "./schema";
import type { PartnerConfig } from "./config";
import type { PartnerApplication } from "./types";

/**
 * Owner notification via Brevo transactional email. Deliberately minimal:
 * reference, partner type, business name, country and a link to the private
 * review page — no applicant contact details, prices or catalog contents.
 * Never adds anyone to a contact list.
 */
export type NotifyResult = { status: "sent" } | { status: "failed"; code: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function notificationEmail(app: PartnerApplication, reviewUrl: string) {
  const type = PARTNER_TYPES.find((t) => t.id === app.type)?.short ?? app.type;
  const business = String(app.fields.business ?? "").slice(0, 120);
  const country = String(app.fields.country ?? "").slice(0, 100);
  const subject = `New partner application ${app.id} (${type})`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c">
<h2 style="margin:0 0 12px">New partner application</h2>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><b>Reference</b></td><td>${esc(app.id)}</td></tr>
<tr><td><b>Type</b></td><td>${esc(type)}</td></tr>
<tr><td><b>Business</b></td><td>${esc(business)}</td></tr>
<tr><td><b>Country</b></td><td>${esc(country)}</td></tr>
</table>
<p><a href="${esc(reviewUrl)}" style="color:#1f5fd6;font-weight:bold">Open it in the private review area</a> (sign-in required).</p>
<p style="color:#3a5486;font-size:13px">Contact details are only shown in the review area. Nothing has been approved or sent to the applicant.</p>
</body></html>`;
  return { subject, html };
}

export async function notifyOwner(cfg: PartnerConfig, app: PartnerApplication, siteOrigin: string): Promise<NotifyResult> {
  const { subject, html } = notificationEmail(app, `${siteOrigin}/partners/review/${app.id}`);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": cfg.brevoKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "FunkSquish website", email: cfg.notifyFrom },
        to: [{ email: cfg.notifyTo }],
        subject,
        htmlContent: html,
        tags: ["partner-application"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { status: "sent" };
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    return { status: "failed", code: `brevo-${res.status}${body.code ? `-${String(body.code).slice(0, 40)}` : ""}` };
  } catch (err) {
    return { status: "failed", code: (err as Error)?.name === "TimeoutError" ? "timeout" : "network" };
  }
}
