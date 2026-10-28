# Deploy-preview verification plan — refunds, delays and disputes (sandbox only)

**Status (2026-10-27): NOT RUN on a preview.** A combined preview now exists (PR #15, DO NOT MERGE) and CI passed on it;
results so far and blockers: `docs/PREVIEW-VERIFICATION-RESULTS.md`. The refund, shipment-delay and chargeback flows on this branch pass their automated
tests (249/249) and a local build, but **none of them has been exercised on a real Netlify deploy preview with Stripe
sandbox data.** This plan is what has to happen before that can be claimed. It uses Stripe **test mode only**; nothing
here touches live keys, production settings or real customers.

## Why it hasn't run yet

1. **No preview is built for this PR.** Netlify builds Deploy Previews for pull requests into `main` (PR #11 got one);
   stacked PRs — PR #5 → `main`'s chain, PR #12 → PR #5, and this branch → PR #12 — show no Netlify status at all.
2. **The sandbox key can't refund.** The restricted test key is limited to Checkout Sessions, so the owner page's Refund
   button returns `more_permissions_required` (`docs/STRIPE-PRODUCTION.md`). A refund test needs a sandbox restricted key
   with **Checkout Sessions: write + Refunds: write**.
3. **Test mode sends no email** unless `STRIPE_TEST_SEND_EMAILS=true` on the preview.
4. The sandbox webhook endpoint must also be subscribed to the three new `charge.dispute.*` events.
5. This audit session has no Netlify, Stripe or Brevo access (by design).

## Set-up (owner — Deploy Previews context only, never Production)

| Step | Who |
| --- | --- |
| 1. Preview: **done** — PR #15 (DO NOT MERGE) into `main` has a deploy preview of everything combined: `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app`. Close it after testing. | ✅ |
| 2. Netlify env vars, **Deploy Previews / branch deploys scope only**: `STRIPE_TEST_CHECKOUT_ENABLED=true`, `STRIPE_TEST_SECRET_KEY` = sandbox restricted key with Checkout Sessions **and Refunds** write, `STRIPE_TEST_SHIPPING_RATE_IDS`, `STRIPE_TEST_SEND_EMAILS=true`, `ORDER_NOTIFY_EMAIL` = owner. Review login vars already exist for previews. | Owner (secrets) |
| 3. Stripe **sandbox** → Developers → Webhooks: endpoint `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app/api/stripe/test-webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`; put its signing secret in `STRIPE_TEST_WEBHOOK_SECRET` (previews only). | Owner |
| 4. Use only the owner's own email addresses at checkout (test emails will really be sent). | Owner |

## Tests and pass criteria

| # | Flow | Steps (sandbox) | PASS when |
| --- | --- | --- | --- |
| V-1 | Order + ship-by | Buy a test fixture with Stripe's 4242 test card | Order appears in `/partners/review/orders`; "Ship by" shows the 2nd business day after today (Eastern); confirmation email received |
| V-2 | Partial refund | On the order, refund $1.00 (type the order number) | Stripe shows one $1.00 refund; order shows **refunded $1.00 once** even after the `charge.refunded` webhook arrives; "can still refund" = total − $1.00 |
| V-3 | Full cancel | Second order → "Cancel order" | Stripe refund = full amount incl. shipping/tax; order canceled; stock released |
| V-4 | Delay ≤ 30 days | On an unshipped order, "Send a delay notice" with a date ~10 days out | Email received with the new date, a cancel-by-reply option and "if we don't hear from you, we'll take that as agreeing"; package ship-by updated; notice recorded "sent" |
| V-5 | Renewed / unknown delay | Send a second notice, then on another order tick "can't give a date" | Emails ask the customer to **reply to agree**, give a cancel-by date (original + 30 days) for the unknown case; ship-by unchanged for "unknown" |
| V-6 | Failed delay email | Temporarily blank `ORDER_EMAIL_FROM`/Brevo in previews, send a notice | Owner page shows an error; ship-by **unchanged**; nothing recorded as sent |
| V-7 | Overdue flag | Use an order whose ship-by date has passed (or wait) | Orders list shows "ship overdue" first |
| V-8 | Dispute opened | Pay with the **dispute test card** listed under "Disputes" on Stripe's [test card numbers](https://docs.stripe.com/testing) page | Order flagged "disputed" with reason, status and evidence due date at the top of "needs attention" |
| V-9 | Dispute won | In the sandbox Dashboard, respond to the dispute with `winning_evidence` in "Additional information" | `charge.dispute.closed` received; dispute status "won"; "disputed" flag cleared |
| V-10 | Dispute lost | Repeat V-8, respond with `losing_evidence` | Status "lost"; flag cleared; refund records unchanged |
| V-11 | Duplicates | Resend each event from the Dashboard | Logged as duplicate; no second order, refund or dispute record |
| V-12 | Policy record | Inspect any new order | "Policies shown at checkout: terms=…;shipping=…;returns=…;privacy=…"; Terms notice visible above Stripe's Pay button |

### Mixed-order shipping (branch `claude/upbeat-hawking-aonyc6-shipping`)

| # | Flow | Steps (sandbox) | PASS when |
| --- | --- | --- | --- |
| V-13 | Single origin | On `/checkout/test`, add 2 × TEST Jelly, open the cart | Cart shows shipping $6.50 and total before tax; Stripe's page shows one "Shipping" line of $6.50 and the same total before the Pay button |
| V-14 | Mixed, three origins | Add Jelly, Mint and Peach; pay with 4242 | Cart lists 3 packages ($4.50 + $5.99 + $7.00); Stripe shows "Shipping (3 packages)" $17.49 and the package note above the address form; the order has 3 packages with ship-by dates 2, 3 and 5 business days out; confirmation email lists all three |
| V-15 | Blocked supplier | Add the Lime item (unverified supplier) | Cart marks it "Shipping … isn't set up yet" and disables checkout; the harness "Try it" row is rejected; no Stripe session created |
| V-16 | One package canceled / lost | On the V-14 order: cancel the Peach package; mark the Jelly package shipped, then "Carrier confirmed it lost" → "Send a free replacement" → ship again | Stripe shows one refund equal to the Peach package total; the order keeps the other packages; the replacement gets a new ship-by date and its own "(replacement)" email |

### Shared inventory (branch `claude/upbeat-hawking-aonyc6-inventory`)

| # | Flow | Steps (sandbox) | PASS when |
| --- | --- | --- | --- |
| V-17 | TikTok sale limits the website | `/partners/review/inventory`: tap "Sold 1 on TikTok" on TEST Jelly Pink (1 left); then try to buy it on `/checkout/test` | Shelf 1 → 0; cart says sold out; checkout refused; activity log shows the sale |
| V-18 | Concurrent last unit | Two browsers: one opens Stripe checkout for the last TEST Jelly Blue unit; the other records a TikTok sale of it | The sale asks for confirmation ("in shoppers' checkouts"); if confirmed and the first shopper pays, the order is flagged "oversold" |
| V-19 | LIVE routine | Start a LIVE with two items (pause on website), record sales, end with TikTok numbers that differ by one, resume | Items paused only during the LIVE; difference recorded with "End-of-LIVE reconciliation"; counts correct |
| V-20 | Shipping deducts once | Ship a paid test order, then update its tracking | Shelf count drops once; "Website order shipped" logged once |

### Owner two-step sign-in (branch `claude/upbeat-hawking-aonyc6-mfa`)

| # | Flow | Steps (preview) | PASS when |
| --- | --- | --- | --- |
| V-21 | Set up | Sign in → Security → set up with a real authenticator app → save recovery codes | Code accepted; other browser's session signed out |
| V-22 | Two-step sign-in | Sign out, sign in: passphrase → code; try a wrong code; try the same code again | Wrong and reused codes refused; right code reaches Today |
| V-23 | Bypass attempts | With only the passphrase done, open `/partners/review/orders`, `/inventory`, and replay a captured server-action request | No data shown; actions refused (redirect to sign-in) |
| V-24 | Recovery + turn off | Sign in with a recovery code; turn two-step off; set up again | Code works once; turning off signs out everywhere |

### Payment methods (owner decision: cards only, Link off)

| # | Flow | Steps | PASS when |
| --- | --- | --- | --- |
| V-25 | No Link, cards only | After turning Link off in the Stripe sandbox (docs/OWNER-ACTIONS.md), open any test checkout on the preview | Stripe's page offers card entry (and Apple Pay / Google Pay where the device supports them) only — no "Save my information with Link", no Link bank or Klarna options |

Record results (date, preview URL, Stripe event ids, PASS/FAIL) in the PR. Afterwards: remove `STRIPE_TEST_SEND_EMAILS`,
delete test orders if desired, and close any temporary PR/branch deploy. **Production variables are never touched.**

Sources: [Stripe test card numbers](https://docs.stripe.com/testing) (dispute evidence values `winning_evidence` /
`losing_evidence` are documented there; the dispute card number wasn't re-verified in this session — read it from that
page).
