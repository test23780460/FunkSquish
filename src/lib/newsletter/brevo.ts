/**
 * Brevo double opt-in subscription (server-side only).
 *
 * Brevo sends the confirmation email itself; the contact is only added to the
 * list after they click the link. Unsubscribe links and subscriber export are
 * handled in Brevo. No email address is ever stored by this website.
 *
 * Required server env vars (set in Netlify, never committed, never NEXT_PUBLIC_):
 *   BREVO_API_KEY            API key (Brevo > SMTP & API > API keys)
 *   BREVO_LIST_ID            numeric id of the "Launch list"
 *   BREVO_DOI_TEMPLATE_ID    numeric id of the double opt-in confirmation template
 * Optional:
 *   NEWSLETTER_CONFIRMED_URL page shown after confirming (default /newsletter/confirmed)
 *
 * API reference: https://developers.brevo.com/reference/createdoicontact
 */
export function brevoConfigured() {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID && process.env.BREVO_DOI_TEMPLATE_ID);
}

export type SubscribeOutcome = "confirmation-sent" | "failed";

export async function subscribeWithDoubleOptIn(email: string): Promise<SubscribeOutcome> {
  if (!brevoConfigured()) return "failed";
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  const redirectionUrl = process.env.NEWSLETTER_CONFIRMED_URL ?? "https://funksquish.com/newsletter/confirmed";

  const res = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY as string,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      includeListIds: [listId],
      templateId,
      redirectionUrl,
      // No custom attributes: Brevo rejects any attribute that isn't defined in the account.
    }),
    cache: "no-store",
  });

  // 201/204 = confirmation email sent. Brevo answers 400 for some duplicates;
  // we show the same neutral message either way so addresses can't be probed.
  if (res.ok) return "confirmation-sent";
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (res.status === 400 && body.code === "duplicate_parameter") return "confirmation-sent";
  // Log Brevo's reason for debugging — never the email address or the API key.
  console.error(`[newsletter] Brevo error ${res.status} ${body.code ?? ""}: ${String(body.message ?? "").replace(/\S+@\S+/g, "[email]").slice(0, 200)}`);
  return "failed";
}
