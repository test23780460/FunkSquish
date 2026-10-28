# Open legal and accounting questions — FunkSquish

_Prepared 2026-10-27 for a Kentucky-licensed attorney and an accountant. Not legal advice; nothing here has been approved._

## The business in one paragraph

FunkSquish is a pre-launch online shop for squishy toys (fruit "slushies", jelly, crunchy and collectible squishies)
run by **Travis Phillips, a sole proprietor doing business as FunkSquish**, mailing address 207 Towne Dr, Unit #1029,
Elizabethtown, KY 42701 (a private mailbox). The website (funksquish.com, Next.js on Netlify) sells nothing yet.
Planned: card payments through **Stripe Checkout** (built and locked, not live), shipping to the 50 states, D.C. and
APO/FPO/DPO addresses only, buyer-paid shipping, items from own stock shipping within 2 business days, some items
possibly shipped directly by suppliers, and a separate **TikTok Shop** storefront with TikTok LIVE selling. The site has
a launch email list and drop/restock alerts (Brevo, double opt-in, both switched off), a partner/supplier application
form (switched off), cookieless analytics (Umami, on in production), and playful features (quiz, "Squish Lab" toy,
"Squish Box" builder, wishlists) that keep data in the visitor's browser. Products will be **children's products**
under the CPSIA.

**Documents to review** (all in the repository): draft Privacy Policy and Terms (`/privacy`, `/terms` — marked Draft
and noindex), Shipping and Returns policies (owner-approved Oct 24, 2026; clarified Oct 27 — see
`docs/POLICY-COMPARISON.md`), the partner privacy notice (`/partners`), and the audit (`docs/MASTER-LEGAL-AUDIT.md`).

## Priority 1 — needed before any customer data collection or sales

### Q-COPPA-1. Is the site "directed to children" or "mixed audience" under COPPA? (Attorney)
- **Facts:** animated mascot, bright playful design, a personality quiz and toy-like "Squish Lab", product category that
  appeals to children; no age questions anywhere; email forms (launch list, drop alerts) collect email addresses when
  switched on; analytics are cookieless (Umami; IP used transiently for location, Umami says not stored).
- **Law:** 16 CFR 312.2 "directed to children" factors (subject matter, visual content, animated characters,
  child-oriented activities, audience evidence) and the new "mixed audience" definition; amended COPPA Rule effective
  June 23, 2025, compliance date **April 22, 2026** (written security program, retention limits, separate consent for
  disclosures). FTC policy statement (Feb 2026) on age-verification data.
- **Questions:** (a) Classification? (b) If mixed audience, what age screen before email sign-up (neutral age gate) and
  what happens for under-13s? (c) Are cookieless analytics events within the "support for internal operations"
  exception? (d) Do the forms need "for adults/13+" language, and does saying so create actual knowledge issues?
- **Current state:** forms off; Privacy draft says the site isn't directed to under-13s and forms are meant for adults.
  Launch gate **M-2** blocks the email lists until answered.

### Q-TERMS-1. Is our assent method enough? (Attorney)
- **Facts:** No accounts. Terms say "By using the Site or placing an order, you agree". The proposed checkout shows, above
  Stripe's Pay button, "By paying, you agree to the FunkSquish Terms of Service, Shipping Policy and Returns & Refunds
  Policy: funksquish.com/terms…", and stores the policy versions with each order.
- **Questions:** Is this "sign-in-wrap" style notice adequate in Kentucky and generally, or should checkout use a required
  checkbox (Stripe `consent_collection.terms_of_service`)? Should the policies be linked from the order confirmation email?

### Q-WAR-1. Warranties and limitation of liability for children's products (Attorney)
- **Facts:** Terms limit liability only for the Site's tools ("as is"), keep implied warranties for products, and don't
  limit liability for injury caused by negligence. Returns offer replacement/refund for damaged, defective or wrong items
  (ideally reported within 7 days; later reports reviewed "in line with your legal rights").
- **Law:** KRS 355.2-314/-316 (merchantability; disclaimer rules); Magnuson-Moss (15 U.S.C. 2301 et seq.) — does the
  Returns promise count as a "written warranty" (an undertaking to refund/replace), triggering 16 CFR 700–702 duties and
  the ban on disclaiming implied warranties?
- **Questions:** (a) Written warranty or not? (b) Any wording needed for latent defects reported after 7 days? (c) Is the
  limitation clause enforceable and fair? (d) Any Kentucky-specific consumer-contract rules we're missing?

### Q-TAX-1. Sales tax setup (Accountant)
- Kentucky sales and use tax permit; collecting 6% on taxable toys and delivery charges; Stripe Tax configuration;
  marketplace-facilitator treatment of TikTok Shop sales; economic-nexus monitoring by state.

### Q-RET-1. Record retention schedule (Accountant + attorney)
- **Facts:** Orders will be stored in Netlify Blobs (name, email, address, optional phone, items, amounts, Stripe ids,
  refunds, disputes, tracking, policy versions). Stripe keeps its own records. The Privacy draft leaves the order period
  blank ("[period to be decided]").
- **Law/guidance:** IRS — generally 3 years, 6 if income under-reported by >25%, 7 for bad-debt/worthless-securities
  claims; Kentucky — 103 KAR 31:020 ties sales-tax record retention to the assessment limitation in KRS 139.620
  (period **not confirmed** in this audit). Product-safety recalls need buyer contact details for the product's life.
- **Questions:** How long to keep (a) full order records, (b) a minimized version after that (e.g., without phone/email),
  (c) customer emails, (d) chargeback evidence? Does a recall-contact need justify longer retention of contact details?

### Q-SAFE-1. Is FunkSquish a "manufacturer"/importer for any product? (Attorney / CPSC Small Business Ombudsman)
- Repacking items into own mystery bags or a "Squish Box", private-labelling, or importing directly may make FunkSquish
  responsible for the Children's Product Certificate, third-party testing, tracking labels and CPSC eFiling (in force
  since **July 8, 2026**).

### Q-SAFE-2. Online choking-hazard warnings (Attorney)
- **Facts:** Label warnings now appear in a box directly above the buy button; product cards for such products don't
  offer a buy button (they link to the product page).
- **Law:** 16 CFR 1500.20 (cautionary statements in advertising that offers a direct means to purchase, including
  websites). **Question:** Is our placement/format sufficient, and must the abbreviated or full statement appear on
  category listings too?

## Priority 2 — needed before go-live of specific features

### Q-PRIV-1. State privacy-law applicability (Attorney)
- Kentucky Consumer Data Protection Act (KRS 367.3611 et seq., effective Jan 1, 2026) applies at 100,000 Kentucky
  consumers (or 25,000 + >50% revenue from data sales) — we expect to be far below. Confirm no other state law applies at
  our size, and whether our voluntary rights process (access/correct/delete, 30-day target, appeal by reply) is sensible.

### Q-PRIV-2. Keyed IP hashes (Attorney)
- Partner applications keep a keyed (HMAC) hash of the applicant's IP for abuse detection. Is this "personal information"
  needing more than the current disclosure?

### Q-PRIV-3. 30-day response target and verification (Attorney / owner)
- Is a 30-day target appropriate? Is "reply to the email on the order + order number" adequate verification before
  disclosing an address?

### Q-BREACH-1. Breach-notification plan (Attorney)
- KRS 365.732 covers specific data elements; order records hold names, addresses and emails (no card numbers). What notice
  duties would a breach of order records trigger in Kentucky and in customers' states?

### Q-FTC-1. Mail Order Rule compliance of our delay process (Attorney)
- Review the Shipping Policy "If your order is delayed" section and the delay-notice email in the checkout branch
  (`delayNoticeEmail`): is email reply an adequate "cost-free means" to cancel, and are the silence/consent rules right
  for first and renewed delays (16 CFR 435.2(b))?

### Q-PROMO-1. Giveaways (Attorney)
- Official-rules template for TikTok/LIVE giveaways (no purchase necessary, eligibility incl. minors, odds, prize value,
  state registration thresholds, TikTok promotion rules).

### Q-INS-1. Product liability insurance (Owner + broker)
- Coverage before selling children's products; marketplaces may require it.

### Q-ENT-1. Business form (Attorney/accountant)
- Assumed-name certificate for "FunkSquish" with the Hardin County clerk (KRS 365.015); whether an LLC is advisable before
  selling children's products.

### Q-RET-2. Returns that don't qualify — unclaimed customer property (Attorney) — updated 2026-10-27
- **Owner decision:** no automatic disposal. Draft Returns text (kept Draft for this review): if a voluntary return
  doesn't qualify, we email the customer explaining why and offer to send it back at their expense, keep it safe while
  we wait, "won't throw it away just because time has passed: if it's never claimed, we'll handle it as the law
  requires", and keep items tied to an open dispute, chargeback or legal claim.
- **Questions:** Under Kentucky law (bailment, unclaimed/abandoned property), what notice and waiting period make an
  item legally "unclaimed", and what may we then do with it (donate, destroy, sell)? Any recordkeeping required? Does
  the wording above promise anything we can't keep? What if the customer is in another state?

### Q-TAX-3. Partial refunds per package and Stripe Tax reporting (Accountant) — new 2026-10-27
- **Facts:** mixed orders ship as several packages, each with its own shipping charge. Canceling or refunding one
  package refunds its items (incl. their tax), its shipping and its share of the tax on shipping, as one Stripe refund.
  Stripe Tax calculates tax on items and on shipping (shipping tax code) when it's switched on.
- **Questions:** Do these partial refunds reduce Kentucky (and other states') reported tax correctly through Stripe Tax,
  or do refunds need tax-transaction reversals or manual adjustments? Is shipping taxable in Kentucky for these items?

### Q-SHIP-2. Per-package shipping disclosures (Attorney) — new 2026-10-27
- **Facts:** the cart and Stripe's page show each package's charge (cart), the combined shipping, tax and total before
  payment; the Shipping Policy says mixed orders can cost more and no shipping is added later. Supplier items that can't
  go to APO/FPO/DPO are disclosed on Stripe's page; such orders are refunded for those items.
- **Questions:** Is this enough under the FTC Act and Kentucky law for drip-pricing/hidden-fee concerns? Do we need the
  per-package breakdown on Stripe's page too (today it shows the combined amount and a text note)?

### Q-INV-1. "Only a few left" with manually shared stock (Attorney) — new 2026-10-27
- **Facts:** website and TikTok Shop sell one physical stock; TikTok sales are recorded by hand, so for a few minutes
  the website's count can be higher than reality (checkout then refuses or flags the order). Since the 2026-10-27
  follow-up (#17), product pages, cards and search-engine data use the same live shared count as the cart and
  checkout ("Only a few left" at 3 or fewer; paused or unreadable stock shows "Unavailable"); a sale not yet recorded
  can still make a label briefly wrong.
- **Questions:** Any risk in "In stock" / "Only a few left" labels that can briefly be wrong? Should the Terms say more
  about canceling oversold orders (they already allow cancel + full refund when an item is out of stock)?

### Q-SEC-1. Is our owner-area security "reasonable"? (Attorney) — new 2026-10-27
- **Facts:** one owner login (passphrase + authenticator-app code, required once live checkout or partner applications are on — and those features stay closed until it's set up), rate limits,
  encrypted second-factor secret, 8-hour sessions, no per-person accounts, no access log of who viewed which order.
- **Questions:** Enough for the FTC's "reasonable security" expectations and state breach-law safe harbors at our size?
  Anything to add before scaling (access logs, separate accounts)?

## Priority 3 — can wait, but decide before scaling

- **Q-TAX-2:** Kentucky treatment of sales tax on returned goods and partial refunds.
- **Q-ARB-1:** Keep "no arbitration, Kentucky law, small claims allowed", or add venue/arbitration terms?
- **Q-AGE-1:** Minimum purchaser age of 18 (or parent/guardian) — appropriate and enforceable?
- **Q-P65-1:** California Proposition 65 — OEHHA says businesses with fewer than 10 employees are exempt from warning
  requirements; confirm and check supplier contracts.
- **Q-ADA-1:** Web accessibility risk under ADA Title III (no DOJ technical standard for private businesses; DOJ 2022
  guidance points to WCAG). Automated axe-core checks show no serious/critical issues on the key pages.
- **Q-MKT-1:** TikTok Shop seller terms vs. our website policies (TikTok's damaged-item window and return-shipping rules
  differ; the website policies say marketplace orders follow marketplace rules).

## Answers needed back

For each question: the answer, any wording to insert, and whether it blocks a launch gate in
`docs/COMPLIANCE-LAUNCH-GATES.md`. Please mark up the drafts directly if easier — every policy change is tracked in git.
