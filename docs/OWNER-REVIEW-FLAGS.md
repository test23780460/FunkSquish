# Items flagged for explicit owner review

> **Update 2026-10-27 (Phase 2): all four were decided by the owner.**
> 1. Mixed-order shipping → **allowed at launch**, built as cart-dependent per-package shipping from verified rates
>    (PR #16, `docs/MIXED-ORDER-SHIPPING.md`). Option A is withdrawn.
> 2. 30-day disposal → **removed**; ineligible returns are explained, offered back at the buyer's cost, kept safe and
>    never disposed of because time passed (PR #19; Returns kept Draft for legal review — Q-RET-2).
> 3. Owner MFA → **required before real orders**, built (PR #18, `docs/OWNER-SECURITY.md`).
> 4. Deploy preview → **DO NOT MERGE PR #15** built and passed CI; the sandbox run itself is still to do
>    (`docs/PREVIEW-VERIFICATION-RESULTS.md`).
>
> The analysis below is kept for the record.

_2026-10-27 · Not legal advice. Each item needs a written decision from the owner (and, where marked, an attorney or
accountant) before the related feature is switched on. Nothing here changes code, settings or the owner-approved policies._

Related PRs: **#13** (policies, this branch) and **#14** (checkout compliance fixes, stacked on #12).

---

## 1. One shipping charge per mixed order — is it financially and operationally supportable?

**What the drafts say.** Shipping Policy (proposed, needs approval): "The shipping charge you pay at checkout covers your
whole order — we never charge extra shipping later, even if your order arrives in more than one package." Terms: "We won't
add charges after checkout."

**What the code does.** Checkout (#12/#14) offers the same fixed Stripe shipping rates (`STRIPE_*_SHIPPING_RATE_IDS`)
whatever the cart contains. A cart with our own stock **and** supplier-shipped items becomes two packages
(`in_house-1`, `supplier-1`) but pays one shipping charge.

**Financial exposure.** For every mixed order, FunkSquish pays for a second shipment (the supplier's shipping or
drop-ship fee) that the customer didn't pay for. Per mixed order:

> unrecovered cost ≈ own label cost + supplier shipping/fee − shipping charged at checkout

Inputs needed (none are in the repository; supplier pricing is private): packed weights, own label cost by zone, each
supplier's per-order shipping/fee, and the expected share of mixed carts.

**Operational load.** Two tracking numbers, two ship-by dates, possible delay notice for one package only, and more "item
not received" claims for the second package. The checkout branch (#14) already tracks each package separately.

**Legal note.** Not charging more after checkout isn't optional — charging a card again without authorization isn't
allowed — so the policy sentence itself is low-risk. The decision is about how the checkout rate is set.

**Options**
| Option | Effect | Work |
| --- | --- | --- |
| A. Launch with our own stock only (recommended for launch) | No mixed carts exist; the question waits until supplier items are added (gate F-3 already blocks supplier-shipped products) | None |
| B. Set the flat rate to cover the worst case | Simple; single-source orders overpay a little | None (rate choice) |
| C. Cart-dependent rate at checkout | Mixed carts see a higher shipping price before paying | Small code change in #14 (inline `shipping_rate_data`), not built |
| D. Don't allow mixed carts | Customers check out twice, each with its own shipping | Small validation change, not built |

**Decision needed:** D-SHIP-1 — choose A–D (A recommended), and approve or reword the Shipping sentence.

---

## 2. The 30-day disposal provision for nonconforming returns — is it appropriate?

**What the draft says** (Returns, proposed by this audit — **not owner-approved**): if a change-of-mind return arrives
opened, used, damaged after delivery, or isn't the item we sent, "we'll tell you and either send it back to you (you pay
postage) or, if you prefer, dispose of it safely … If we don't hear back within 30 days of our message, we may dispose of
it safely."

**Why it was added.** Without it, the policy said nothing about returns that don't qualify, which invites disputes and
leaves FunkSquish storing other people's items indefinitely.

**Risks**
- **It's still the customer's property.** Disposing of it after a single, possibly missed, email could support a claim
  for its value. Rules for goods left with a business vary by state; Kentucky specifics were **not verified** in this audit.
- **Evidence.** A substituted or used item may be the main evidence in a chargeback or fraud claim. Disposing of it while
  a dispute is open would hurt FunkSquish.
- **Safety.** Leaking or damaged squishies shouldn't be mailed back at all. The Returns policy already says so for
  defects, but this provision covers change-of-mind returns only.
- **TikTok Shop returns** follow TikTok's process, not this one.

**Recommended safeguards (operational — no policy change needed because the text says "may")**
1. Photograph the parcel and item on arrival; keep the photos with the order.
2. Send two emails: one on arrival and a reminder about 7 days before the 30-day mark.
3. **Never dispose while a dispute, chargeback or fraud review is open** for that order.
4. Keep a disposal record (date, method, photos).

**Options:** approve 30 days with the safeguards above (recommended) · use 60 days instead · drop disposal and return
the item at the customer's cost after 30 days · remove the sentence (back to silence).

**Decision needed:** D-RET-1 — choose an option. **Attorney:** Q-RET-2 (added to `LEGAL-OPEN-QUESTIONS.md`).

---

## 3. Does the owner order-management area need MFA before handling real customer information?

**Current protection** (`/partners/review`, which #12 extends to `/partners/review/orders`): one shared passphrase
(scrypt-hashed, at least 14 characters), rate limits (5 tries per 15 minutes per IP, 30 per hour overall), 8-hour
`HttpOnly`/`Secure`/`SameSite=Strict` session cookie, every server action re-checks the session, and changing the
passphrase signs out every device. There's no second factor, no individual accounts and no record of who viewed which
order.

**What it would protect.** Customers' names, email addresses, shipping addresses, optional phone numbers and order
history (no card numbers — those stay with Stripe), plus partner applications.

**Law.** This audit found **no statute that specifically requires MFA** for a business of this kind (attorney to
confirm). But a breach would bring notification duties (KRS 365.732 and customers' home states), possible FTC scrutiny of
unreasonable security, and — if COPPA ends up applying — the amended Rule's written security-program requirement. One
phished passphrase is enough to take every customer's address today.

**Recommendation: yes — require a second factor before the first real order.**
- **P-SEC-1 (not built):** a time-based one-time code (authenticator app, RFC 6238) checked at sign-in, with the secret
  stored as a Netlify secret env var and one-time recovery codes. No outside service needed. Small-to-medium change.
- Also turn on 2-step verification for every account that can reach customer data: Stripe, Netlify, Google Workspace,
  Brevo and GitHub.
- Gate C-8 currently allows a written risk acceptance instead of MFA. **Decision needed:** D-SEC-1 — make MFA mandatory
  (recommended) or accept the risk in writing.

---

## 4. Do the refund, shipment-delay and chargeback processes work on a real Netlify deploy preview with sandbox data?

**Status: NOT VERIFIED.** They pass automated tests (#14: 249/249; trial merge with #13: 323/323), but they have never
run on a Netlify deploy preview against the Stripe sandbox. Reasons:

- Netlify only builds deploy previews for PRs into `main` here — #11 got one; #12, #13 and #14 (stacked PRs) have none.
- The sandbox restricted key can't create refunds (`more_permissions_required`); it needs **Refunds: write**.
- Test mode sends no emails unless `STRIPE_TEST_SEND_EMAILS=true` on previews.
- The sandbox webhook endpoint must be subscribed to the three `charge.dispute.*` events.
- This session has no Netlify, Stripe or Brevo access.

**How to verify:** follow `docs/PREVIEW-VERIFICATION-PLAN.md` in #14 — 12 checks (V-1 … V-12) with pass criteria,
using only the Deploy Previews scope and sandbox keys; production settings are never touched.

**Decision needed:** D-QA-1 — how to get a preview (temporary "do not merge" PR into `main`, or a Netlify branch deploy)
and who runs the plan. Gate **C-10** (added) requires it to pass before live payments.

---

## Monitoring

No continuous monitoring of these PRs, CI or deployments is configured: the repository has no GitHub Actions, the stacked
PRs get no Netlify builds, and no scheduled check or PR subscription was set up in this session. Checks reported in the PRs
were run manually on the dates stated. (The only scheduled job in the project is the existing partner-data retention
cleanup on production.)
