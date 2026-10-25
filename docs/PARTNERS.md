# Partner & distributor applications

_Status: built and **disabled**._ `/partners` is live in the code as a public page, but the form only opens once every
safeguard below is configured. Until then it shows an honest "email us" fallback with a pre-filled subject line.

## What it does

- **Public page** (`/partners`): six partner types — manufacturers, wholesale suppliers, dropshipping/fulfillment,
  brands, independent designers and resellers/distributors — each with its own "what we look for" and form fields
  (`src/lib/partners/schema.ts` is the single source for both the form and validation).
- **Submission** (`src/lib/partners/submit.ts`) runs, in order:
  1. hidden honeypot field → bots get a normal-looking reply, nothing stored
  2. signed, timestamped form token (rejects posts faster than 3 s, older than 2 h, or forged)
  3. strict validation: known fields only, length caps, listed choices only, public http(s) links only
     (no `javascript:`, IPs, localhost or credentials), no files, 12,000-character / 60-field cap
  4. rate limits: 5 per IP per hour, 10 per IP per day, 3 per email per day, 200 per day overall
  5. private storage in Netlify Blobs, then an owner notification via Brevo transactional email
- **If the notification fails**, the application is still saved, marked "Email failed" in the review list, and can be
  re-sent from its page. Applicants always see "received — this isn't an approval".
- **Never**: auto-approval, emails to applicants, marketing-list sign-ups, affiliate codes, supplier purchases, file
  uploads, or contact details/prices in logs, analytics or the notification email.

## Private review (`/partners/review`)

- Returns **404** unless the review login is configured.
- Owner signs in with a passphrase (scrypt-hashed; 5 attempts per 15 minutes per IP, 30 per hour overall). The session
  is an 8-hour signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/partners/review`; changing the
  passphrase signs out every device. Pages send `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
- Every review **server action re-checks the session** (server actions are public endpoints). Next.js also rejects
  server-action posts whose `Origin` doesn't match the site (CSRF protection).
- Stages: **New → Under review → Need more info → Approved for follow-up / Declined**, with private notes and history.
  Changing a stage never contacts the applicant — reply yourself with the "Reply by email" button.
- Delete permanently (type the reference to confirm). Applications older than the proposed retention period are
  flagged "Past retention".

## Data & retention (proposed — needs your/legal review)

| Stored | Why |
| --- | --- |
| Answers to the form (name, work email, business details, product info, message) | Review and reply |
| Consent version + time | Record of agreement to store and contact |
| Keyed hash of the IP (not the IP) | Spam/rate limiting |
| Notification status, stage history, your notes | Workflow |

Storage: Netlify Blobs store `partner-applications` (production) and `partner-applications-preview` (deploy
previews), plus `partner-rate-limits[-preview]`. Blobs are private to the site and never served publicly; nothing goes
to GitHub. **Proposed retention:** delete 24 months after the last update unless you start working together; delete
sooner on request. The privacy notice on `/partners` and the draft privacy policy say this.

Rate-limit counters are tiny and keyed by hashed IP/email per hour/day; they can be cleared any time.

## Setup (all values are secret Netlify env vars — never in chat, email or GitHub)

| Step | Who |
| --- | --- |
| 1. Run `npm run partners:setup` **in your own terminal**. Choose a passphrase (at least 14 characters; save it in your password manager). It prints `PARTNER_REVIEW_PASSPHRASE_HASH` and `PARTNER_SECRET`. | **You** |
| 2. Netlify → Environment variables, scoped to **Deploy Previews** first, each marked "Contains secret values": the two values from step 1, plus `PARTNER_NOTIFY_EMAIL=travis@funksquish.com`, `PARTNER_NOTIFY_FROM=travis@funksquish.com` (already a verified Brevo sender) and `PARTNER_APPLICATIONS_ENABLED=true`. `BREVO_API_KEY` already exists with "Transactional email" permission. | **You** (secrets) / Claude (non-secret ones) |
| 3. Push or redeploy the preview, sign in at `/partners/review` on the preview, submit a test application, confirm the notification email arrives and the stage/notes/delete flow works, then delete the test application. | Claude + you |
| 4. Approve the privacy wording and retention period, then add the same variables for **Production**. | **You approve** |

Local testing only: `PARTNER_DEV_MEMORY_STORE=true` in a git-ignored `.env.development.local` uses an in-memory store
(data disappears on restart). It never applies outside `next dev`.

## Verified

- Unit tests (`tests/partners/`): validation and unsafe input, tokens, sessions, passphrase hashing, rate limits,
  honeypot, storage failure, notification failure and timeout, no PII in logs or the notification, HTML escaping,
  review actions refusing without a session, sign-in lockout.
- Local browser run (in-memory store, fake Brevo key): form opens with a token, client validation, successful
  submission with reference, notification failure recorded, sign-in (wrong then right passphrase), list, detail,
  stage + note, delete with confirmation, sign-out.
- **Not yet verified:** Netlify Blobs on a real deploy preview and a real Brevo notification email (needs step 2).
