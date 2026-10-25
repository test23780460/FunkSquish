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

## Before it can go live

- **Postal address (blocker):** U.S. CAN-SPAM requires a valid physical postal address in every marketing email — a USPS PO box or a registered private mailbox is fine ([FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)). Brevo also asks for one in your account and adds it to the email footer.
- **Domain authentication (needs your DNS approval):** Brevo shows the exact records under *Senders, Domains & Dedicated IPs → Domains*. They are **new** records (a `brevo-code` TXT, DKIM records, and usually a DMARC TXT). Never edit or replace the Google MX, SPF, or `google._domainkey` records. If Brevo asks to change SPF, merge it into the single existing SPF record — never add a second SPF record.
- **Privacy policy approved** (owner decision B6 in `docs/OWNER-DECISIONS.md`). The policy's "active / not active yet" label updates automatically from the build configuration.

## Setup steps

| Step | Who |
| --- | --- |
| 1. Create a free Brevo account (Sign up with Google using travis@funksquish.com is easiest) | **You** |
| 2. Fill Brevo's company profile incl. the postal address | **You** |
| 3. Create list **"FunkSquish Launch List"**, note its ID | Claude (once you're signed in) |
| 4. Templates → New template → paste `templates/email/brevo-double-opt-in.html`; subject "Confirm your FunkSquish launch emails 💙"; mark it as the double opt-in template; note its ID | Claude |
| 5. Senders: add/verify `travis@funksquish.com` as sender "FunkSquish" (Brevo emails a code to that inbox) | Claude + you (code) |
| 6. Domains: add `funksquish.com`, copy the exact DNS records Brevo shows | Claude → **your approval** → add in Squarespace |
| 7. SMTP & API → API keys → create `funksquish-website` → paste it into Netlify env var `BREVO_API_KEY` (mark "Contains secret values") | **You** (keys must never pass through chat) |
| 8. Netlify env vars `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID`, and `NEWSLETTER_ENABLED=true` scoped to **Deploy Previews** only | Claude |
| 9. Test on the deploy preview: sign up → confirmation email → confirm → appears in list → unsubscribe works | Claude + you (inbox) |
| 10. Approve go-live → add `NEWSLETTER_ENABLED=true` for **Production** → redeploy | You approve, Claude does it |

Env vars only affect new builds — after changing them, redeploy (previews: push a commit; production: costs one deploy).

## Current setup (FunkSquish Brevo account, travis@funksquish.com)

| Item | Value | Status |
| Company address (email footer) | FunkSquish, 207 Towne Dr Unit 1029, Elizabethtown, KY 42701 (Brevo → My Profile) | ✅ set |
| --- | --- | --- |
| List | "FunkSquish Launch List", ID **3** | ✅ created |
| Double opt-in template | "FunkSquish Double Opt-in Confirmation", ID **1**, tag `optin`, sender "FunkSquish" / travis@funksquish.com, reply-to travis@funksquish.com | ✅ active |
| Sender | travis@funksquish.com | ✅ verified |
| Netlify (Deploy Previews only) | `BREVO_LIST_ID=3`, `BREVO_DOI_TEMPLATE_ID=1`, `NEWSLETTER_ENABLED=true` | ✅ set |
| Netlify `BREVO_API_KEY` | key `funksquish-website`: Restricted, **Contacts = All + Transactional email = All** (nothing else), MCP off | ✅ added by owner, secret, Deploy Previews only (Production empty) |
| Domain authentication | records below, added in Squarespace with owner approval | ✅ authenticated in Brevo |

DNS records added for Brevo (all **new**; nothing existing changed, SPF untouched):

| Type | Host (Squarespace) | Value |
| --- | --- | --- |
| TXT | `@` | `brevo-code:01e5cb113dc94fa80527b8983f23fd6e` |
| CNAME | `brevo1._domainkey` | `b1.funksquish-com.dkim.brevo.com` |
| CNAME | `brevo2._domainkey` | `b2.funksquish-com.dkim.brevo.com` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

`p=none` is monitor-only: it never blocks or quarantines mail, including Google Workspace mail. Brevo now sends as travis@funksquish.com with DKIM signed by funksquish.com.

### Test results (Deploy Preview, Oct 24, 2026)

| Step | Result |
| --- | --- |
| Sign-up form submits (desktop) | ✅ success message |
| Confirmation email sent + delivered | ✅ Brevo transactional log, tag `optin` |
| Confirm link → contact added to "FunkSquish Launch List" (#3) | ✅ |
| Sign-up + confirm on a phone (new contact, Gmail) | ✅ email delivered, confirmed, added to list #3; layout OK per owner |
| Marketing email footer + unsubscribe | ✅ test campaign #2 sent to list #3 (2 owner addresses): footer address shown, `{{ unsubscribe }}` link → Brevo marked travis@funksquish.com "Unsubscribed from email campaigns" (still gets transactional emails) |

**Fixes that were needed** (keep for future accounts/keys):
1. New Brevo accounts can't send until Brevo approves them. The API answers `403 permission_denied: Your SMTP account needs to be activated`. Request activation via a support ticket (done: ticket #5634982, approved the same night).
2. Even after approval, the same 403 appears if the API key lacks **Transactional email** permission, because the double opt-in endpoint sends an email. The key needs **Contacts = All** and **Transactional email = All**.
3. Don't send custom contact attributes unless they exist in the Brevo account (removed `SOURCE`).
4. Keep Brevo's "block unauthorized IPs" **off** for API keys — Netlify functions don't have fixed IPs.

### API key expiry (check before launch)

Brevo disables a key after **90 days without use** and at its expiry date (**Oct 24, 2027**). If sign-ups are quiet for 3 months, the form would start failing. Before launch, and every few months, check *Brevo → SMTP & API → API keys*; if `funksquish-website` is expired, create a new one with the same permissions and replace `BREVO_API_KEY` in Netlify.

## Drop & restock alerts (separate list)

_Status: built and **disabled**._ The form on `/drops` and on product pages stays greyed out (pointing to TikTok)
until every item below is done. It uses a **separate** Brevo list and confirmation email, so the launch list is never
touched. Code: `src/app/actions/drop-alerts.ts`, `src/lib/newsletter/brevo.ts` (`subscribeToDropAlerts`).

| Step | Who |
| --- | --- |
| 1. In Brevo, create list **"FunkSquish Drop & Restock Alerts"**, note its ID | Claude (with you signed in) |
| 2. Templates → new template from `templates/email/brevo-drop-alerts-double-opt-in.html`, subject "Confirm your FunkSquish drop alerts 💙", tag `optin`, sender travis@funksquish.com; note its ID | Claude |
| 3. Netlify env vars for **Deploy Previews**: `BREVO_DROPS_LIST_ID`, `BREVO_DROPS_DOI_TEMPLATE_ID`, `DROP_ALERTS_ENABLED=true` (the existing `BREVO_API_KEY` already has Contacts permission) | Claude |
| 4. Test on a deploy preview: sign up → confirmation email → confirm → contact appears in the drops list only → unsubscribe works | Claude + you (inbox) |
| 5. Approve the privacy-policy wording (already in the draft) and go live: add the vars for **Production** | **You approve** |

**Sending alerts:** when a drop or restock is real, send a Brevo campaign to the drops list only. Only announce a
restock once the stock is actually in hand (the `/drops` page promises this).

Per-product interest isn't tracked: the alert is "new drops and restocks" in general, and the form says so. Tracking
interest per product would need a Brevo contact attribute and an updated privacy notice.
