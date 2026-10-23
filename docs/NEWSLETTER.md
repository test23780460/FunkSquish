# Launch email list

_Status: built and **disabled**. No email addresses are collected until you complete every step below._

## Provider recommendation: Brevo (free plan)

| | Brevo | Kit | MailerLite | Buttondown |
| --- | --- | --- | --- | --- |
| Free plan (2026) | ~100,000 contacts, 300 emails/day ([review](https://www.techradar.com/pro/software-services/brevo-review)) | Up to 10,000 subscribers ([guide](https://www.passivekit.com/kit-free-plan/)) | Cut to 250 subscribers / 2,500 emails ([update](https://emailoctopus.com/blog/mailerlite-pricing-update)) | 100 subscribers ([pricing](https://buttondown.com/pricing)) |
| Double opt-in via API | ✅ dedicated endpoint ([docs](https://developers.brevo.com/reference/createdoicontact)) | Form-based; API flow less clear | Account setting | — |
| Unsubscribe + export | ✅ | ✅ | ✅ | ✅ |
| Free-plan catch | Brevo logo in emails; 300/day send cap | Kit branding, limited automation | Very small list cap | Very small list cap |

**Why Brevo:** a documented double opt-in API (Brevo sends the confirmation email and only adds people after they click), generous contact storage, and built-in unsubscribe/export. The 300 emails/day cap means a launch email to 900 people spreads over 3 days unless you buy a one-off send pack. **Kit** is the best alternative if you'd rather have 10,000 free subscribers and don't mind wiring a different adapter.

## How it works on the site

- Form: consent checkbox (required) + email → Server Action `subscribeToLaunchList` (`src/app/actions/newsletter.ts`) → Brevo double opt-in.
- Nothing is stored by the website or in the browser. A hidden honeypot field blocks simple bots. The same neutral message is shown for new and existing addresses.
- After confirming, people land on `/newsletter/confirmed`.
- A successful sign-up fires an analytics event `newsletter-signup` (no email address is sent to analytics).

## Setup steps (owner)

1. Create a free Brevo account with travis@funksquish.com. **Authenticate your domain** in Brevo (Senders & IP → Domains). Brevo will give you DNS records (DKIM/TXT) to add in Squarespace. **These are new records — do not edit or remove your existing Google MX, SPF, or DKIM records.** If Brevo asks you to change SPF, merge the include into the existing SPF record rather than adding a second SPF record; ask for help if unsure.
2. Contacts → Lists → create **"FunkSquish launch list"**. Note its numeric **list ID**.
3. Templates → create a **double opt-in confirmation** template (Brevo has a DOI template type). Branding: use the FunkSquish logo, a short friendly message, and the confirmation button. Note the **template ID**.
4. SMTP & API → API keys → create a key named `funksquish-website`. **Don't paste it into chat, email, or GitHub.**
5. In **Netlify → Site configuration → Environment variables**, add:
   - `BREVO_API_KEY` (mark as secret)
   - `BREVO_LIST_ID`
   - `BREVO_DOI_TEMPLATE_ID`
6. Update and finalize the **Privacy Policy** newsletter section (`src/app/privacy/page.tsx`).
7. Set `newsletter: true` in `src/lib/features.ts`, push to a branch, and test on the deploy preview with your own address (confirm → check you appear in the list → unsubscribe works).
8. Merge to `main` (one production deploy).

The form only turns on when **both** the env vars exist **and** the switch is on.
