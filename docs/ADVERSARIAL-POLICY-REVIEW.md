> **Superseded (2026-10-27):** this first-pass review is kept for history. The full audit, which re-checked every item
> below, is in `docs/MASTER-LEGAL-AUDIT.md`, with scenarios in `docs/ADVERSARIAL-SCENARIOS.md`, wording changes in
> `docs/POLICY-COMPARISON.md`, attorney/accountant questions in `docs/LEGAL-OPEN-QUESTIONS.md`, launch gates in
> `docs/COMPLIANCE-LAUNCH-GATES.md` and results in `docs/FINAL-AUDIT-SUMMARY.md`. Note: item 21's "receive and check"
> refund wording changed an owner-approved term and has been restored to "after we receive the return".

# Adversarial policy review — 2026-10-27

**Draft findings; not legal advice.** Reviewed the proposed PR #11 legal text against known Stripe checkout, Netlify storage, partner-application flows, refunds, shipping and FTC guidance. Changes on this branch remain unmerged. An attorney should review all policy changes before final approval.

## Changes made in this pass

1. **Privacy international processing:** removed blanket assertion that all vendor data stays in the United States. Actual processing locations and service terms should be verified provider-by-provider.
2. **Public sharing:** clarified that someone with a shared Squish Box/wishlist link may view link contents and shared URLs do not disappear when the creator clears local data.
3. **Children:** intent not to target under-13s alone does not determine COPPA status. The site, design, marketing, age of actual audience, forms, and any analytics need assessment.
4. **Privacy verification:** email-address access alone may be inadequate before disclosing a customer's delivery address or order history. Promise a 30-day target subject to legally applicable periods/extensions.
5. **Retention:** replaced vague implication that all emails are retained on one definite schedule; needs documented operational retention and deletion across Gmail, Brevo, Stripe and Netlify.
6. **Security:** avoid unqualified promises that private information could never appear in logs or be accessible beyond a single owner. Validate operational practices first.
7. **Privacy vs contract:** Terms link to the Privacy Policy as a notice rather than purporting to obtain legally sufficient privacy consent simply by using the site.
8. **Checkout:** avoid implying a cart submission charges a card; payment is captured following successful checkout.
9. **Canceled orders:** explain full refund for canceled entire order, including attributable shipping and tax.
10. **Pricing errors:** prohibit unilateral higher-price charges or misleading price substitutions.
11. **Product accuracy:** material, size, age guidance and warnings must be accurate; material substitutions require agreement.
12. **Quantity limits:** publicize limits before checkout; don't use a vague limit to alter paid orders.
13. **Shipping delays:** busy LIVE demand cannot automatically extend promised shipping deadlines.
14. **Supplier fulfillment:** don't offer products unless you can support a disclosed ship-by commitment.
15. **Delivery estimates:** distinguish carrier estimates from express guaranteed delivery promises.
16. **Delayed shipment:** require timely notices, legally sufficient choice/consent, and prompt refunds. FTC silence-consent rules are nuanced; the actual process must comply with 16 CFR Part 435, not rely solely on policy text.
17. **Missing parcel investigations:** don't require a carrier claim before honoring legal obligations.
18. **Damaged/misdescribed goods:** seven-day reporting and photo requests cannot extinguish nonwaivable rights.
19. **Voluntary returns:** separate 30-day unopened change-of-mind returns from statutory remedies.
20. **Blind bag final sale:** only voluntary change-of-mind exclusions, clearly disclosed before sale; not a defense to defective/wrong goods.
21. **Refund timing:** distinguish inspected returns from unshipped-order cancellations; legally required refund deadlines still apply.

## Adversarial scenarios to test in code + operations before launch

| Hostile or difficult scenario | Failure to prevent | Owner/engineering action |
| --- | --- | --- |
| Buyer checks out for a territory Stripe lists under US | Merchant takes money for undeliverable address | Block address before payment if possible, else detect and promptly cancel/refund; test continuously |
| Supplier misses estimate or disappears | Merchant's 'supplier-shipped' exception used to stall refunds | Require proven supplier ship-by date, owner notifications and a delay-consent/refund workflow |
| Angry buyer claims squishy leaked after day 7 | Support treats voluntary reporting window as legal cutoff | Triage safety and statutory rights; don't automatically reject |
| Buyer uses shared URL containing personal box name | Information unintentionally exposed | Explain disclosure; limit unnecessary text; test referrer behavior |
| Attacker controls a customer's email inbox | Order history and home address exposed in a privacy request | Stronger identity checks for disclosure; avoid overcollection |
| Refund issued but app crashes before recording it | Refund attempt retried, accounting inconsistent | Reconcile Stripe by refund ID; robust idempotency; owner audit |
| Email accepted by Brevo then request times out | Sending retried and duplicate notice arrives | Don't promise literally exactly-once delivery; reconcile provider acceptance where possible |
| Product safety issue or recall | Broad 'as-is' term incorrectly used to deny remedies | Keep consumer rights and safety processes separate; make recall response plan |
| Partner asks deletion while legal hold is active | Unbounded hold or blanket deletion promise | Document hold basis, scope, review date, and responses |
| Terms/return policy changed after purchase | New terms imposed retroactively | Preserve purchase-time policy version with orders; clearly date and archive revisions |

## Remaining unresolved before publication

- COPPA / child-directed determination and age-related UX.
- Review by counsel of privacy law applicability, guarantees, terms, product liability, dispute provisions and non-waivable consumer rights.
- Tax and accounting retention schedule; data minimization by record type; audit deletion ability.
- Accurate identification of providers, regions, user rights, disclosures and consent flows.
- Real supplier ship-by time enforcement, mixed orders, restock/refund and automated FTC delay-option notices.
- Exact shipping rates, tax configurations, destination filtering, product-safety certifications and purchase-time labels.
- Make policies reflect **actual code and operations**, not anticipated features; test each statement.
- Ensure "draft" + noindex remain until legal review and owner's explicit approval.

Official references:
- FTC Mail, Internet, or Telephone Order Merchandise Rule: https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule
- 16 CFR Part 435: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-435

**Verification:** This pass updated files in the draft branch through GitHub. Automated tests and a preview deployment have NOT been executed in this review session. Claude or CI must rerun checks, inspect differences, and resolve any failures.
