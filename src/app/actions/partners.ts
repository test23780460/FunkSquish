"use server";

import { headers } from "next/headers";
import { partnerSetup } from "@/lib/partners/config";
import { issueFormToken } from "@/lib/partners/security";
import { handleSubmission, type PartnerSubmitState } from "@/lib/partners/submit";
import { MFA_GATE_TEXT, ownerMfaReady } from "@/lib/owner/mfa-gate";

/*
 * Every export here is a public endpoint. Keep it to these three; all the
 * logic (and anything that takes config) lives in server-only modules.
 */

/**
 * Whether the page shows the form (decided when the page is built). Taking a
 * form token and storing an application additionally need the owner's
 * two-step sign-in, checked on every request below.
 */
export async function partnerApplicationsOpen() {
  return partnerSetup().ready;
}

/** Signed, timestamped token the form must send back (blocks instant bot posts and replays from old pages). */
export async function getPartnerFormToken(): Promise<string | null> {
  const { config } = partnerSetup();
  return config && (await ownerMfaReady()).ready ? issueFormToken(config.secret) : null;
}

export async function submitPartnerApplication(formData: FormData): Promise<PartnerSubmitState> {
  if (!(formData instanceof FormData)) return { status: "error", message: "Invalid request." };
  const { config } = partnerSetup();
  if (!config) return { status: "closed" };
  // Nothing is stored unless the owner area that holds it has two-step sign-in.
  const mfa = await ownerMfaReady();
  if (!mfa.ready) {
    console.warn(`[partners] form closed: ${MFA_GATE_TEXT[mfa.reason]}`);
    return { status: "closed" };
  }
  return handleSubmission(config, formData, await headers());
}
