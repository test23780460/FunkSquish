# Partner & distributor applications

_Status: built and **disabled**._ `/partners` is live in the code as a public page, but the form only opens once every
safeguard below is configured. Until then it shows an honest "email us" fallback with a pre-filled subject line.

## What it does

- **Public page** (`/partners`): six partner types — manufacturers, wholesale suppliers, dropshipping/fulfillment,
  brands, independent designers and **future** resellers/distributors — each with its own "what we look for" and form
  fields (`src/lib/partners/schema.ts` is the single source for the form, validation and the review page).
- **Questions by type** (only 5–9 are required; everything else is optional):

  | Type | Asks about |
  | --- | --- |
  | Wholesale suppliers | SKU pricing per quantity tier, MOQ, mixed cases, samples and sample cost, shipping cost estimate, U.S. delivery time, order turnaround, proof of authorization |
  | Manufacturers | SKU pricing, MOQ, samples and sample cost, production lead time, custom/OEM, shipping |
  | Dropshipping & fulfillment | Subscription fee, per-order fees, how orders are sent (manual, CSV, API, store app), custom Next.js store support, inventory syncing, blind shipping, tracking, returns/refunds/damaged parcels |
  | All product suppliers (**required** safety screen) | Water beads (none / sealed / loose), recalls or serious complaints in 5 years, Children's Product Certificate; plus age grade, materials and fillings, filling composition, independent lab reports (ASTM F963, lead, phthalates, EN 71) |
  | Suppliers, brands, designers (**required**) | Which channels they authorize: funksquish.com, TikTok Shop, TikTok LIVE, social posts, other marketplaces — plus any limits |
  | Future resellers | Must tick "this is future interest — not an account, order or price quote"; where they sell, region, rough first-order size. Their confirmation says "Interest noted", not "Application received". |

- **Submission** (`src/lib/partners/submit.ts`) runs, in order:
  1. hidden honeypot field → bots get a normal-looking reply, nothing stored
  2. signed, timestamped form token (rejects posts faster than 3 s, older than 2 h, or forged)
  3. strict validation: known fields only, length caps, listed choices only, public http(s) links only
     (no `javascript:`, IPs, localhost or credentials), no files, 16,000-character / 120-field cap
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
- Answers are grouped by section. A **"Look at these first"** box lists advisory flags from the applicant's own answers
  (water beads, recalls, missing CPC or lab reports, can't show authorization); the list marks serious ones "Safety
  check". Flags never approve, decline or hide anything (`src/lib/partners/screening.ts`).
- Answers to questions from an older version of the form are still shown under "Other answers".
- Delete permanently (type the reference to confirm). Applications older than the proposed retention period are
  flagged "Past retention".

## Data & retention (owner-approved 2026-10-26; legal review still open)

| Stored | Why | Where |
| --- | --- | --- |
| Answers to the form (name, work email, business details, products, pricing, safety, channels, message) | Review and reply | `partner-applications` |
| Consent version + time | Record of agreement to store and contact | with the application |
| Keyed hash of the IP (not the IP) | Spam protection | with the application |
| Notification status, stage history, owner notes, legal hold | Workflow | with the application |
| Rate-limit counters (keyed hashes of IP/email) | Spam/rate limiting | `partner-rate-limits` |
| Retention run reports (counts only), deletion-request records (dates, hashed email, references, outcome) | Show cleanup and requests happen on time | `partner-ops` |

Stores get a `-preview` suffix on deploy previews, so preview and production data never mix. Blobs are private to the
site and never served publicly; nothing goes to GitHub.

### Retention schedule (enforced by `src/lib/partners/retention.ts`)

| Data | Deleted |
| --- | --- |
| Declined applications | 12 months after the last activity |
| New / Under review / Need more info | 24 months after the last activity |
| Future reseller/distributor interest | 24 months after the last activity |
| Approved for follow-up | Never automatically. Yearly review ("Review due" badge, Monday alert email). Press "We're still working together" to restart the year, or copy what your records need and delete it. |
| Rate-limit counters | 2 days after their time window started |
| Deletion-request records | 24 months after completion (exceptions stay until closed) |
| Run reports | Last 30 kept |

**Last activity** = the submission, a stage change, an owner note, or "We're still working together". Re-sending the
notification, legal holds, cleanup runs and other bookkeeping never restart the clock (they only change `updatedAt`,
which the rules ignore). A **legal hold** (with a documented reason) stops deletion until released.

### Automatic cleanup

- `netlify/functions/partner-retention.mts` — Netlify Scheduled Function, **every day at 08:00 UTC**. Netlify only runs
  scheduled functions on the published production deploy and doesn't expose them at a public URL there.
- Re-checks each record just before deleting it, continues past individual failures, and is safe to re-run (a failed
  item is picked up the next day).
- Logs one line of counts and error codes (`[partners] retention ok: applications checked=… deleted=…`) — never names,
  emails, answers or storage keys.
- **Failure detection:** the review page shows the last run and turns red if there's been no successful run for 36
  hours; the owner gets an email (counts only) when a run fails or partly fails, or deletion requests are due/overdue.
- **Dry run:** set `PARTNER_RETENTION_DRY_RUN=true` (Production, functions scope) to report without deleting, or press
  "Dry run" in the review area. Dry runs never count as a successful cleanup.
- Deploy previews (no schedule there): use "Run cleanup now" / "Dry run" in the review area.

### Deletion requests (runbook)

1. Someone emails asking to delete their application → open **/partners/review/requests**, enter the email they applied
   with and the date the request arrived. The deadline (30 days) is calculated; the email is stored only as a keyed hash.
2. The page lists matching applications (by reference and business name). If none match, check the address with them.
3. Type the request number and press **Delete and complete** — every match is deleted at that moment and the outcome
   is recorded. Or, after getting advice, **record a legal exception** with the reason (re-open it when it no longer applies).
4. Reply to them, then delete the request and notification emails from your inbox (the website can't reach Gmail).
   Brevo keeps its own sending log under Brevo's retention policy.

Not covered by the website (owner tasks): Gmail copies of notification emails and replies, and anything copied into
other business records. The encrypted `npm run backup` only covers the `private/` folder — it never contains
applications, which live only in Netlify Blobs (no separate backups are made).

## Setup (all values are secret Netlify env vars — never in chat, email or GitHub)

**Quickest:** `npm run partners:setup -- --netlify` asks for your passphrase (hidden) and saves both secrets straight to Netlify Deploy Previews. Add `--generate` to have it create a strong passphrase and save it only to `private/partner-review-passphrase.txt` (git-ignored); move it to your password manager and delete the file. Use `--netlify=production` when going live.

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
- **Verified on a real Netlify deploy preview (2026-10-26, PR #10):** form opens with a signed token, an application
  saved to `partner-applications-preview` in ~2 s, Brevo delivered the owner email to travis@funksquish.com (it shows
  as from "me" in Gmail because it's sent from the same address), owner sign-in, resend notification, stage change
  with history, private note, refused delete with the wrong reference, delete with the right one. Test data removed.
- **Netlify gotchas fixed along the way:** the build-time context must be read as literal
  `process.env.BUILD_CONTEXT`; Netlify Blobs reads of keys that don't exist can hang, so `kv.ts` checks existence
  with a list first; every storage call has a 5 s limit so applicants get the "email us" message instead of a crash.
- **2026-10-26 question update:** 86 unit tests pass (new: every question in exactly one section, required safety and
  channel answers, reseller acknowledgement, "None yet" can't combine with real lab reports, a fully answered form of
  every type fits the size limits, screening flags). Local walkthrough at 1280 px and 375 px (no sideways scrolling for
  any type), error states, wholesale submission with a sealed-water-bead answer flagged in review, reseller "Interest
  noted" confirmation. Screenshots: `docs/screenshots/partners-v2/`.
- **Verified on the PR #10 deploy preview (2026-10-26, commit 6289228):** all six types show the right sections and
  required counts at 1280 px and 375 px (no sideways scrolling, no cut-off placeholders); empty dropship form shows the
  10 required-field errors; a full dropship application (loose water beads, recall) saved to Netlify Blobs with the
  owner email sent, every answer shown in review with 2 serious + 3 check flags and a "Safety check" badge; stage
  change to Declined with a note and history; a reseller entry was refused until the acknowledgement was ticked, then
  confirmed as "Interest noted" with no safety flags; both test entries deleted, store empty. SEO on the preview:
  robots allows all, 15 canonical sitemap URLs, canonicals match, excluded pages carry noindex (Netlify also adds
  `X-Robots-Tag: noindex` to every preview response, as expected for previews).
- **Not verified yet:** production (needs `--netlify=production` setup and your approval).
