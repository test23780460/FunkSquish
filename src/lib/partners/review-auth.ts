import "server-only";
import { cookies } from "next/headers";
import { reviewConfig } from "./config";
import { SESSION_COOKIE, checkSession } from "./security";
import { partnerStores } from "./store";

/**
 * Returns the review context only for a signed-in owner; null otherwise.
 * Every review page AND every review server action must call this first —
 * server actions are public endpoints, so the page check alone isn't enough.
 */
export async function requireReviewer() {
  const cfg = reviewConfig();
  if (!cfg) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!checkSession(cfg.secret, cfg.passphraseHash, token)) return null;
  return { cfg, stores: await partnerStores(cfg) };
}
