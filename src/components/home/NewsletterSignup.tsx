import { newsletterAvailable } from "@/app/actions/newsletter";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Launch-email sign-up.
 *
 * DISABLED until BOTH are true (see docs/NEWSLETTER.md):
 *   1. Brevo env vars are set in Netlify (BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID)
 *   2. `features.newsletter` is switched on (after the privacy policy is updated)
 * While disabled the form is shown greyed out and cannot submit anything.
 */
export async function NewsletterSignup({ className }: { className?: string }) {
  const enabled = await newsletterAvailable();
  return <NewsletterForm enabled={enabled} className={className} />;
}
