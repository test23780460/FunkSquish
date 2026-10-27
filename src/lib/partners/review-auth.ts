import "server-only";
import { ownerAuth } from "@/lib/owner/auth";

/**
 * Returns the review context only for a FULLY signed-in owner; null otherwise.
 * Every owner page AND every owner server action must call this first —
 * server actions are public endpoints, so the page check alone isn't enough.
 *
 * "Fully" means the passphrase plus, once two-step sign-in is set up (or
 * required — see src/lib/owner/auth.ts), the second factor. A passphrase-only
 * session waiting for its code gets null here, so it can't read or change
 * anything; it can only reach the code page.
 */
export async function requireReviewer() {
  const auth = await ownerAuth();
  if (!auth || auth.status !== "full") return null;
  return { cfg: auth.cfg, stores: auth.stores };
}
