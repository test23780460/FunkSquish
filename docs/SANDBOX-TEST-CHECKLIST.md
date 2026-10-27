# Sandbox test checklist — your steps to run V-1 … V-25 on preview #15

_2026-10-27. Stripe **sandbox** and Netlify **Deploy Previews** only — never Production, never live keys. Never paste a
key, signing secret, passphrase, authenticator code or recovery code into chat, GitHub or email: copy each value
straight from Stripe into Netlify. The checks themselves are in `docs/PREVIEW-VERIFICATION-PLAN.md`._

Preview: `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app` (PR #15, DO NOT MERGE).

## A. Stripe Dashboard — sandbox (test mode switched on, top of the Dashboard)

1. **Developers → API keys** → either **edit** your existing sandbox restricted key (`funksquish-test-website`) or
   create a new restricted key, with exactly: **Checkout Sessions: Write**, **Refunds: Write** (new — the Refund
   button needs it), **Products: Read**, **Prices: Read**, **Shipping Rates: Read**; everything else **None**. (The
   code reads order line items with their product details, which is why the reads are needed — the same set your
   Oct 24 key had, plus Refunds.) Keep the page open for step B2.
2. **Developers → Webhooks → Add endpoint**:
   - URL `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app/api/stripe/test-webhook`
   - Events (8): `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
     `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
   - Then **Reveal** its signing secret (`whsec_…`) for step B2.
3. **Settings → Payment methods**: turn **Link** off; leave **Cards** on (Apple Pay / Google Pay are card wallets).
   Needed for V-25.
4. Keep Stripe's [test card numbers](https://docs.stripe.com/testing) page open (4242 card, 3-D Secure card, the
   dispute card and the `winning_evidence` / `losing_evidence` values).

## B. Netlify — Site configuration → Environment variables

1. For each variable below choose **"Different value for each deploy context"** and fill in **Deploy Previews only**
   (leave Production and the others empty). Tick **"Contains secret values"** where marked.

   | Variable | Value | Secret |
   | --- | --- | --- |
   | `STRIPE_TEST_CHECKOUT_ENABLED` | `true` | no |
   | `STRIPE_TEST_SECRET_KEY` | the restricted key from A1 (`rk_test_…`) | **yes** |
   | `STRIPE_TEST_WEBHOOK_SECRET` | the signing secret from A2 (`whsec_…`) | **yes** |
   | `STRIPE_TEST_SEND_EMAILS` | `true` — only while testing | no |
   | `ORDER_NOTIFY_EMAIL` | your own address | no |

2. **Check these already exist for Deploy Previews** (don't re-create them if they do):
   - `PARTNER_SECRET` and `PARTNER_REVIEW_PASSPHRASE_HASH` (owner sign-in). If missing, run
     `npm run partners:setup -- --netlify` **in your own terminal** — it saves both to Deploy Previews without showing them.
   - `BREVO_API_KEY` (secret) and `ORDER_EMAIL_FROM` or `PARTNER_NOTIFY_FROM` (a Brevo-verified sender) — for the
     emails in V-1, V-4, V-14 and V-16.
3. **Not needed any more:** `STRIPE_TEST_SHIPPING_RATE_IDS` (PR #21 removed that requirement; leaving an old value is
   harmless). **Never add any `STRIPE_LIVE_*` variable**, and don't change anything in the Production context.
4. **Deploys →** PR #15's deploy preview → **Retry deploy** (variables only apply to new builds). Wait for "Published".

## C. On the preview (laptop + phone)

1. Open `/partners/review`, sign in with your preview passphrase → **Security** → set up two-step sign-in with your
   authenticator app and save the recovery codes (V-21). The preview has its own security settings; production isn't
   affected.
2. Run **V-1 … V-25** in order (`docs/PREVIEW-VERIFICATION-PLAN.md`). At Stripe's page use **only your own email
   address** and Stripe's test cards.
3. **V-6 only:** temporarily empty `ORDER_EMAIL_FROM` (and `PARTNER_NOTIFY_FROM` if that's the one set) for Deploy
   Previews → Retry deploy → run V-6 → restore the value → Retry deploy.
4. Optional extras for this follow-up: **V-26** — Inventory → Activity → *Download stock history* opens a CSV with the
   changes you made in V-17…V-20; **V-27** — edit a cart quickly (+/− many times) and check out: never refused.
5. Post a comment on PR #15: date, each check PASS/FAIL, Stripe event ids (`evt_…`) for failures. No keys, codes,
   emails or addresses in the comment.

## D. Afterwards

1. Netlify (Deploy Previews): delete `STRIPE_TEST_SEND_EMAILS` (and set `STRIPE_TEST_CHECKOUT_ENABLED` to `false` if
   you want checkout off on previews).
2. Stripe sandbox: optionally roll/delete the restricted key and delete the webhook endpoint.
3. Close PR #15 **without merging** and delete its branch.
4. Tell me which checks failed (with the on-screen message) and I'll fix them on the right branch.
