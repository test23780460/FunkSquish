"use server";

import { headers } from "next/headers";
import { partnerSetup } from "@/lib/partners/config";
import { issueFormToken } from "@/lib/partners/security";
import { handleSubmission, type PartnerSubmitState } from "@/lib/partners/submit";

/*
 * Every export here is a public endpoint. Keep it to these three; all the
 * logic (and anything that takes config) lives in server-only modules.
 */

export async function partnerApplicationsOpen() {
  return partnerSetup().ready;
}

/** Signed, timestamped token the form must send back (blocks instant bot posts and replays from old pages). */
export async function getPartnerFormToken(): Promise<string | null> {
  const { config } = partnerSetup();
  return config ? issueFormToken(config.secret) : null;
}

export async function submitPartnerApplication(formData: FormData): Promise<PartnerSubmitState> {
  if (!(formData instanceof FormData)) return { status: "error", message: "Invalid request." };
  const { config } = partnerSetup();
  if (!config) return { status: "closed" };
  return handleSubmission(config, formData, await headers());
}
