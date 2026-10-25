import "server-only";
import type { PartnerConfig } from "./config";
import { checkFormToken, clientIp, hashIdentifier } from "./security";
import { createApplication, partnerStores, takeRateLimits, updateApplication } from "./store";
import { notifyOwner } from "./notify";
import { validatePartnerEntries } from "./validate";
import { siteConfig } from "@/lib/site";

export type PartnerSubmitState =
  | { status: "idle" }
  | { status: "success"; reference: string | null }
  | { status: "error"; message: string; errors?: Record<string, string> }
  | { status: "closed" };

/** Honeypot field name. Real people never see it. */
export const HONEYPOT = "fax_number";

export function siteOrigin() {
  const context = process.env.BUILD_CONTEXT || process.env.CONTEXT;
  if (context === "production") return siteConfig.url;
  if (process.env.BUILD_DEPLOY_URL) return process.env.BUILD_DEPLOY_URL.replace(/\/$/, "");
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : siteConfig.url;
}

/** Order matters: cheap checks first, storage last. Server-only — never export from a "use server" file. */
export async function handleSubmission(config: PartnerConfig, formData: FormData, h: Headers, nowMs = Date.now()): Promise<PartnerSubmitState> {
  const entries = [...formData.entries()];

  // Bots that fill the hidden field get a normal-looking reply and nothing is stored.
  if (entries.some(([k, v]) => k === HONEYPOT && typeof v === "string" && v.trim() !== "")) return { status: "success", reference: null };

  const token = String(formData.get("token") ?? "");
  const tokenState = checkFormToken(config.secret, token, nowMs);
  if (tokenState === "too-fast") return { status: "error", message: "That was quick! Please check your answers and submit again." };
  if (tokenState !== "ok") return { status: "error", message: "This form has expired. Please refresh the page and try again." };

  const result = validatePartnerEntries(entries.filter(([k]) => k !== "token" && k !== HONEYPOT));
  if (!result.ok) return { status: "error", message: "Please check the highlighted fields.", errors: result.errors };

  const ipHash = hashIdentifier(config.secret, "ip", clientIp(h));
  const emailHash = hashIdentifier(config.secret, "email", String(result.data.fields.email));

  try {
    const stores = await partnerStores(config);
    const allowed = await takeRateLimits(
      stores.limits,
      [
        { key: `ip-hour/${ipHash}`, max: 5, windowSeconds: 3600 },
        { key: `ip-day/${ipHash}`, max: 10, windowSeconds: 86400 },
        { key: `email-day/${emailHash}`, max: 3, windowSeconds: 86400 },
        { key: "global-day", max: 200, windowSeconds: 86400 },
      ],
      nowMs,
    );
    if (!allowed)
      return { status: "error", message: `We've received a lot of applications from you or overall today. Please try again tomorrow, or email ${siteConfig.email}.` };

    const app = await createApplication(stores.apps, result.data, ipHash, new Date(nowMs));
    const notification = await notifyOwner(config, app, siteOrigin());
    await updateApplication(stores.apps, app.id, (a) => ({
      ...a,
      notification: notification.status === "sent" ? { status: "sent", at: new Date().toISOString() } : { status: "failed", at: new Date().toISOString(), code: notification.code },
    }));
    // Log only the reference, type and outcome — never names, emails or answers.
    console.info(`[partners] stored ${app.id} type=${app.type} notify=${notification.status}${notification.status === "failed" ? `:${notification.code}` : ""}`);
    return { status: "success", reference: app.id };
  } catch (err) {
    console.error(`[partners] storage error: ${(err as Error)?.name ?? "Error"}`);
    return { status: "error", message: `We couldn't save your application just now. Please try again later or email ${siteConfig.email}.` };
  }
}
