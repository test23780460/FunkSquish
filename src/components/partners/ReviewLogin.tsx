import { redirect } from "next/navigation";
import { ownerAuth } from "@/lib/owner/auth";
import { PassphraseForm } from "./PassphraseForm";

/**
 * What an owner page shows instead of its content when the visitor isn't
 * fully signed in: the passphrase form — or, for a session that has passed
 * the passphrase but still needs its second step (or has to set it up), a
 * redirect to that step. Never any owner data.
 */
export async function ReviewLogin() {
  const auth = await ownerAuth();
  if (auth?.status === "needs-mfa") redirect("/partners/review/verify");
  if (auth?.status === "needs-enrollment") redirect("/partners/review/security");
  return <PassphraseForm />;
}
