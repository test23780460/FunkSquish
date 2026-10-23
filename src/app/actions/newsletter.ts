"use server";

import { features } from "@/lib/features";
import { brevoConfigured, subscribeWithDoubleOptIn } from "@/lib/newsletter/brevo";

export type SignupState = { status: "idle" | "success" | "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** True only when the switch is on AND the email provider is configured. */
export async function newsletterAvailable() {
  return features.newsletter && brevoConfigured();
}

/**
 * Launch-list sign-up. Requires explicit consent; uses double opt-in so the
 * person must confirm from their inbox. Nothing is stored by this website.
 */
export async function subscribeToLaunchList(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (!(await newsletterAvailable())) return { status: "error", message: "Email sign-ups aren't open yet." };

  // Honeypot: real people never see or fill this field.
  if (String(formData.get("company") ?? "").trim() !== "") return { status: "success", message: "Thanks! Check your inbox." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { status: "error", message: "Please enter a valid email address." };
  if (formData.get("consent") !== "yes")
    return { status: "error", message: "Please tick the box to agree to receive FunkSquish emails." };

  const outcome = await subscribeWithDoubleOptIn(email);
  if (outcome === "failed") return { status: "error", message: "Something went wrong. Please try again in a bit." };
  return {
    status: "success",
    message: "Almost done! Check your inbox and tap the confirmation link to join the launch list.",
  };
}
