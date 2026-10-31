"use server";

import { headers } from "next/headers";
import { takeSignup } from "@/lib/newsletter/limits";
import { subscribeToDropAlerts } from "@/lib/newsletter/brevo";
import { dropAlertsActive } from "@/lib/integrations/status";

export type DropAlertState = { status: "idle" | "success" | "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function dropAlertsAvailable() {
  return dropAlertsActive();
}

/**
 * New-drop & restock alerts. Separate Brevo list from the launch newsletter,
 * explicit consent, double opt-in. Nothing is stored by this website.
 */
export async function subscribeToDropAlertsAction(_prev: DropAlertState, formData: FormData): Promise<DropAlertState> {
  if (!(await dropAlertsAvailable())) return { status: "error", message: "Drop alerts aren't open yet." };

  // Honeypot: real people never see or fill this field.
  if (String(formData.get("company") ?? "").trim() !== "") return { status: "success", message: "Thanks! Check your inbox." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { status: "error", message: "Please enter a valid email address." };
  if (formData.get("consent") !== "yes")
    return { status: "error", message: "Please tick the box to agree to receive drop and restock emails." };

  // Each sign-up makes Brevo send a confirmation email: limit how many one network can start.
  if (!(await takeSignup("drop-alerts", await headers()))) return { status: "error", message: "Too many sign-ups from your connection. Please try again later." };

  const outcome = await subscribeToDropAlerts(email);
  if (outcome === "failed") return { status: "error", message: "Something went wrong. Please try again in a bit." };
  return {
    status: "success",
    message: "Almost done! Check your inbox and tap the confirmation link to turn on drop alerts.",
  };
}
