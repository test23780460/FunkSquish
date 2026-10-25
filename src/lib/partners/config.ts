import "server-only";
import { features } from "@/lib/features";

/**
 * Partner applications only open when EVERY safeguard is configured:
 * durable private storage, owner notification, and the private review login.
 * Otherwise the public page shows a disabled form and an email fallback.
 * All values are server-side env vars (Netlify, "contains secret values").
 */
export interface PartnerConfig {
  secret: string;
  passphraseHash: string;
  notifyTo: string;
  notifyFrom: string;
  brevoKey: string;
  storage: "blobs" | "memory";
  /** Keeps preview/dev data apart from production data. */
  storeSuffix: "" | "-preview" | "-dev";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSPHRASE_HASH = /^scrypt:\d+:\d+:\d+:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{32,}$/;

function storage(env: NodeJS.ProcessEnv): Pick<PartnerConfig, "storage" | "storeSuffix"> | null {
  const context = env.BUILD_CONTEXT || env.CONTEXT;
  if (context === "production") return { storage: "blobs", storeSuffix: "" };
  if (context === "deploy-preview" || context === "branch-deploy") return { storage: "blobs", storeSuffix: "-preview" };
  // Local testing only, and only when explicitly asked for: data vanishes on restart.
  if (env.NODE_ENV === "development" && env.PARTNER_DEV_MEMORY_STORE === "true") return { storage: "memory", storeSuffix: "-dev" };
  return null;
}

/** What the review area needs (it stays reachable even if new applications are paused). */
export function reviewConfig(env: NodeJS.ProcessEnv = process.env): Pick<PartnerConfig, "secret" | "passphraseHash" | "storage" | "storeSuffix"> | null {
  const s = storage(env);
  const secret = env.PARTNER_SECRET ?? "";
  const passphraseHash = env.PARTNER_REVIEW_PASSPHRASE_HASH ?? "";
  if (!s || secret.length < 32 || !PASSPHRASE_HASH.test(passphraseHash)) return null;
  return { secret, passphraseHash, ...s };
}

export function partnerSetup(env: NodeJS.ProcessEnv = process.env): { ready: boolean; missing: string[]; config: PartnerConfig | null } {
  const missing: string[] = [];
  if (!(features.partnerApplications || env.PARTNER_APPLICATIONS_ENABLED === "true")) missing.push("PARTNER_APPLICATIONS_ENABLED");
  if ((env.PARTNER_SECRET ?? "").length < 32) missing.push("PARTNER_SECRET");
  if (!PASSPHRASE_HASH.test(env.PARTNER_REVIEW_PASSPHRASE_HASH ?? "")) missing.push("PARTNER_REVIEW_PASSPHRASE_HASH");
  if (!EMAIL.test(env.PARTNER_NOTIFY_EMAIL ?? "")) missing.push("PARTNER_NOTIFY_EMAIL");
  if (!EMAIL.test(env.PARTNER_NOTIFY_FROM ?? "")) missing.push("PARTNER_NOTIFY_FROM");
  if (!env.BREVO_API_KEY) missing.push("BREVO_API_KEY");
  const s = storage(env);
  if (!s) missing.push("durable storage (Netlify)");
  if (missing.length || !s) return { ready: false, missing, config: null };
  return {
    ready: true,
    missing,
    config: {
      secret: env.PARTNER_SECRET as string,
      passphraseHash: env.PARTNER_REVIEW_PASSPHRASE_HASH as string,
      notifyTo: env.PARTNER_NOTIFY_EMAIL as string,
      notifyFrom: env.PARTNER_NOTIFY_FROM as string,
      brevoKey: env.BREVO_API_KEY as string,
      ...s,
    },
  };
}
