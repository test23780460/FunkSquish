# Deploy-preview verification plan — refunds, delays and disputes (sandbox only)

**Status (2026-10-27): NOT RUN.** The refund, shipment-delay and chargeback flows on this branch pass their automated
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
| 1. Get a preview built for a branch containing this code. Options: (a) a temporary draft PR into `main` titled "PREVIEW ONLY — DO NOT MERGE", closed after testing; or (b) a Netlify **branch deploy** for `claude/upbeat-hawking-aonyc6-checkout`. Both are previews/branch deploys, never production. | Owner chooses |
| 2. Netlify env vars, **Deploy Previews / branch deploys scope only**: `STRIPE_TEST_CHECKOUT_ENABLED=true`, `STRIPE_TEST_SECRET_KEY` = sandbox restricted key with Checkout Sessions **and Refunds** write, `STRIPE_TEST_SHIPPING_RATE_IDS`, `STRIPE_TEST_SEND_EMAILS=true`, `ORDER_NOTIFY_EMAIL` = owner. Review login vars already exist for previews. | Owner (secrets) |
| 3. Stripe **sandbox** → Developers → Webhooks: endpoint `https://<preview-host>/api/stripe/test-webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`; put its signing secret in `STRIPE_TEST_WEBHOOK_SECRET` (previews only). | Owner |
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

Record results (date, preview URL, Stripe event ids, PASS/FAIL) in the PR. Afterwards: remove `STRIPE_TEST_SEND_EMAILS`,
delete test orders if desired, and close any temporary PR/branch deploy. **Production variables are never touched.**

Sources: [Stripe test card numbers](https://docs.stripe.com/testing) (dispute evidence values `winning_evidence` /
`losing_evidence` are documented there; the dispute card number wasn't re-verified in this session — read it from that
page).
