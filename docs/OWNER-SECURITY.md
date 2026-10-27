# Owner security — two-step sign-in for the owner area

**Status (2026-10-27): built and tested in a draft branch (`claude/upbeat-hawking-aonyc6-mfa`, top of the checkout
stack). Not deployed. Owner decisions: MFA is required before real customer orders (2026-10-27) and before partner
applications with private applicant details (2026-10-27 follow-up).**

The owner area (`/partners/review/**`: Today, Inventory, Orders, Partners, Security) holds customer names, email
addresses, shipping addresses and order history, plus partner applications. Until now one passphrase protected it.
This adds a second factor: a 6-digit code from an authenticator app on your phone (TOTP, RFC 6238). No outside service
or paid product is involved.

## How it behaves

| Situation | Signing in needs | What a passphrase-only session can do |
| --- | --- | --- |
| Not set up, not required (**today, while everything is in draft**) | Passphrase | Everything, exactly as before — **you can't be locked out by this change** |
| Set up | Passphrase **and** a code | Only the code page (for 10 minutes) — every owner page and button refuses |
| Required but not set up — automatically when **live checkout** or **partner applications** are switched on, or when `OWNER_MFA_REQUIRED=true` | Passphrase, then you must set it up | Only the Security page (to set it up) |

### Customer orders and partner applications wait for it

Switching a feature on isn't enough by itself (`src/lib/owner/mfa-gate.ts`):

- **Live checkout** (real customer orders): until the owner has two-step sign-in set up, checkout and the cart's
  shipping quote answer "Checkout isn't open yet" — nothing is reserved or sent to Stripe — and the server log says why.
- **Partner applications** (names, emails, business details): until it's set up, the form gets no submission token and
  every submission is refused as "closed" — nothing is stored, and the log says why (no applicant data). (The public
  page decides whether to show the form when it's built; the check that matters runs on every submission.)
- It fails closed: owner area not configured, no enrollment, an enrollment being reset with `OWNER_MFA_RESET_ID`, or
  the security store unreadable → both stay closed. Each server instance re-checks at least once a minute (immediately
  on the instance where you set it up or turn it off).
- Turning two-step sign-in **off** (e.g. new phone) closes both again until you set it up again — the Security page
  says so before you confirm.

**Safe order (no lock-out, no window where someone else could set it up first):** 1) set up two-step sign-in on
production while everything is still off (it's optional then); 2) save the recovery codes; 3) set
`OWNER_MFA_REQUIRED=true` for Production; 4) only then switch on partner applications or live checkout. If a feature
is switched on before step 1, a passphrase-only sign-in can still reach the setup page (so you're never locked out),
and you're emailed when two-step sign-in is turned on — if you didn't do it, use the "Locked out" steps below.

Every owner page and every owner server action checks this on each request (server actions are public endpoints, so
the page check alone wouldn't be enough). A test fails if a new page or action forgets
(`tests/owner/route-coverage.test.ts`).

## Set it up (about 2 minutes)

1. Sign in → **Security** (top menu) → **Set up two-step sign-in**.
2. On your phone, tap **add FunkSquish to my authenticator app** (or type the setup key shown into Google
   Authenticator, Microsoft Authenticator, 1Password, Authy…). Don't screenshot or share the key; it expires in 15
   minutes if you don't finish.
3. Type the 6-digit code the app shows. Two-step sign-in is now on, and **every other device is signed out**.
4. **Save the ten recovery codes** shown once (password manager, or printed and put away — not on the same phone, never
   in a message). Each signs you in once if you lose your phone.

Do this on **production** before live payments (gate C-8), and separately on any preview you test with (previews keep
their own security settings, like their own test data). Then set `OWNER_MFA_REQUIRED=true` for Production in Netlify
so it can never silently be off.

## Day to day

- Sign in: passphrase → code from the app (or a recovery code).
- Sessions last 8 hours. **Sign out all devices** is on the Security page.
- Wrong codes: 5 tries per 15 minutes per device/network, 20 a day overall (10 a day for recovery codes); after that the
  session ends. Someone getting the passphrase right and the code wrong triggers an email to you (at most hourly) — if
  it wasn't you, **change the passphrase**.
- Codes can't be reused (each 30-second code works once), and the app's clock may be up to 30 seconds off.

## Lost phone, new phone, locked out

| Situation | Do this |
| --- | --- |
| New phone, old one still works | Security → **Turn off two-step sign-in** (code + type TURN OFF) → set it up again on the new phone |
| Lost phone, have recovery codes | Sign in with a recovery code → Security → turn off → set up on the new phone → you'll get new recovery codes |
| Running low on recovery codes | Security → **Make new recovery codes** (needs an app code; old codes stop working) |
| **Lost phone AND all recovery codes** | Break-glass (needs your Netlify login, which should itself have two-step sign-in): Netlify → Site configuration → Environment variables → add `OWNER_MFA_RESET_ID` = the **Reset ID** shown on the Security page / saved with your codes (for **Production** only) → redeploy → sign in with the passphrase → set up two-step sign-in again → **delete `OWNER_MFA_RESET_ID`** and redeploy |
| `PARTNER_SECRET` was changed | The stored secret can't be read any more (it's encrypted with a key derived from it); sign-in says so. Use the break-glass steps above. |

## Change the passphrase

`npm run partners:setup` (locally) prints a new `PARTNER_REVIEW_PASSPHRASE_HASH` → Netlify Production → replace the
value → redeploy. Every session ends immediately (sessions are tied to the passphrase).

## How it's stored

- Own private Netlify Blobs store `owner-security` (`owner-security-preview` on previews; in memory for local dev).
- The authenticator secret is encrypted (AES-256-GCM) with a key derived from `PARTNER_SECRET` (HKDF-SHA256) and bound
  to its enrollment id. Recovery codes are stored only as keyed hashes. A copy of the storage alone reveals neither.
- Session cookie: HTTP-only, `Secure`, `SameSite=Strict`, limited to `/partners/review`, signed; it records whether the
  second step was done, against which setup, and the "sign out everywhere" counter — so turning two-step sign-in off,
  setting it up, or signing out everywhere ends older sessions.
- Logs say only what happened ("mfa failed", "mfa ok via app"), never codes, keys or the passphrase (tested).
- Nothing about this is in GitHub: no secret, code or key is committed.

## Limits (said plainly)

- One shared owner login (no separate accounts per person) and no record of who viewed which order.
- Authenticator-app codes only; passkeys/security keys aren't supported yet.
- The alert email needs `PARTNER_NOTIFY_EMAIL`, `PARTNER_NOTIFY_FROM` and `BREVO_API_KEY`.
- A phished code can still be used within its 30 seconds; always type codes only on the real site address.

## Turn on two-step sign-in for the accounts around the site too (you, in each service)

Not changed by this work — each is set in that service's own settings (menu names may differ):

| Account | Why | Where |
| --- | --- | --- |
| Stripe | Payments, payouts, customers' payment details | Profile → Two-step authentication |
| Netlify | The site, its secrets (including the break-glass variable) and stored orders | User settings → Security |
| Google (business email) | Password resets for everything else | Google Account → Security → 2-Step Verification |
| GitHub | The site's code and deploys | Settings → Password and authentication |
| Brevo | Customer email addresses and sending | Account → Security |
| TikTok Shop / Seller Center | Orders and buyer addresses | Account settings → Security |

## Tests

`tests/owner/` (27 tests): RFC 4226/6238 test vectors, ±1-step drift, no replay; base32; encryption bound to the
enrollment and tamper detection; recovery codes stored hashed. Flows: draft no-lock-out; setup needs a verified first
code and expires; setup signs out other devices; passphrase-only sessions can't run any action; wrong/right/replayed
codes; rate limiting ends the session; 10-minute partial sessions; recovery codes work once; forged cookies refused;
required mode (live checkout / env) allows only setup; sign-out-everywhere, passphrase change and turning off end
sessions; new recovery codes replace old ones; unreadable secret + break-glass; no secrets in logs; every owner page and
action checks the session (static scan, with a mutation check done during development).

Added 2026-10-27 (`tests/owner/mfa-gate.test.ts`, 9 tests, plus a route-coverage check): partner applications switched
on make two-step sign-in required; without an enrollment the partner form issues no token and stores nothing, live
checkout and the cart quote stay closed with nothing held or sent to Stripe; with one, both work; break-glass reset,
missing owner config and an unreadable store all fail closed; the one-minute re-check. Every owner download route
(the inventory CSV) checks the session first, runs per request and only reads. Removing the gate makes 6 of the new
tests fail (checked).
