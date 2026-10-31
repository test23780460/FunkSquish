> **Historical document (kept for the record).** Current guidance: `docs/OWNER-GUIDE.md` and `docs/LAUNCH-CHECKLIST.md` — see `docs/README.md`.

# Adversarial scenarios — FunkSquish legal & compliance audit (2026-10-27)

**Not legal advice.** These are analytical perspectives (consumer-protection, privacy, children's-product, fraud, supplier,
security and QA reviewers), not professional opinions. Each scenario assumes someone is actively looking for a gap, and
weighs the legitimate rights of both the customer and FunkSquish. Nothing here tries to remove a non-waivable consumer right.

**How to read each entry**

- **Move** — what the customer, supplier or attacker does.
- **Weak spot** — the gap they use (before this audit, unless stated).
- **Impact** — plausible business or legal consequence.
- **Policy** — does the policy now cover it? (references are to the draft policies on this branch).
- **Software** — does the code prevent or support it? "Checkout branch" = `claude/upbeat-hawking-aonyc6-checkout` (child of PR #12).
- **Fix** — policy correction / operational or technical correction.
- **Residual** — what's still open. Owner decisions and attorney questions are numbered in `LEGAL-OPEN-QUESTIONS.md`.

Severity tags use the audit scale (P0 critical → P3 low) for the underlying exposure, not the scenario's likelihood alone.

---

## A. Customer disputes and refunds

### A1. Damage reported on day 12 — P2
- **Move:** Buyer reports a leaking squishy 12 days after delivery and cites the old "within 7 days" wording as unfair.
- **Weak spot:** Shipping page, FAQ and PR #12's shipping email stated 7 days as a hard deadline; the Returns page called it a preference.
- **Impact:** Contradictory terms are read against the drafter; a denied claim on a children's product invites a UDAP complaint (KRS 367.170) or chargeback.
- **Policy:** Yes — every page now says "ideally within 7 days"; late reports keep legal rights; latent defects are reviewed "in line with your legal rights".
- **Software:** `tests/legal/rendered-policies.test.ts` fails if any page reintroduces a hard 7-day cutoff; checkout-branch shipping email fixed.
- **Fix:** Done. Ops: triage leaks as safety issues first (stop use, don't mail back leaking items).
- **Residual:** How long implied-warranty claims last is a legal question (Q-WAR-1).

### A2. Opened mystery squishy, "I don't like the one I got" — P2
- **Move:** Buyer opens a blind bag, dislikes the design and demands a refund.
- **Weak spot:** The final-sale exclusion only works if disclosed before purchase, and product pages had no way to show it.
- **Impact:** Without prior disclosure, the exclusion is unenforceable and a refusal looks deceptive.
- **Policy:** Returns: opened mystery items are final sale **only when the product page says "Final sale once opened" before you buy**; defects/wrong items always covered.
- **Software:** New `final_sale_once_opened` catalog column → shown in the buy box above the buy button; product cards for such items link to the product page instead of selling directly; `catalog:check` blocks a published mystery item with no explicit decision.
- **Fix:** Done (legal branch). Checkout branch should also show it in the cart (proposal P-CK-4).
- **Residual:** TikTok Shop's own rules govern TikTok orders.

### A3. "The size/color wasn't as described" — P2
- **Move:** Buyer says the squishy is smaller than pictured and the color differs.
- **Weak spot:** "Minor variations may occur" could be stretched to excuse material differences.
- **Impact:** Misdescription is both a UDAP and a Mail Order/FCBA "not as agreed" issue.
- **Policy:** Terms: a materially different item is a "wrong item" under Returns (free replacement or full refund incl. shipping); colors may look slightly different on screens.
- **Software:** Catalog requires size description and weight before publishing (`tests/catalog/published-products.test.ts`, `catalog:check`).
- **Fix:** Ops: photograph real samples with a size reference; keep listing snapshots (git history of `products.json`).
- **Residual:** "Material" is a judgment call; disputes decided case by case.

### A4. Order canceled by FunkSquish after payment — P1
- **Move:** Owner cancels a paid order (stock error); buyer says they were charged and left waiting.
- **Weak spot:** No stated refund deadline for seller-side cancellations.
- **Impact:** FTC Mail Order Rule requires a prompt refund (7 working days for card payments, 16 CFR 435.1).
- **Policy:** Terms + Shipping: full refund incl. shipping and tax for whole-order cancellations, "within 7 business days at the latest".
- **Software:** PR #12 `cancelOrder` refunds the remaining balance via Stripe in one step.
- **Fix:** Done. Ops target: same business day.
- **Residual:** None material if the owner uses the cancel button.

### A5. Product becomes unavailable after payment (oversold) — P2
- **Move:** Two buyers pay for the last unit during a LIVE rush.
- **Weak spot:** Stock held ~31 min; a late payment can oversell.
- **Impact:** Unfilled paid order; Mail Order Rule clock still running.
- **Policy:** Terms "Availability and substitutions": refund, replacement only if wanted; never substitute without agreement.
- **Software:** PR #12 flags `oversold`; checkout-branch attention list puts it at the top of the owner's queue.
- **Fix:** Done. Ops: refund the oversold unit the same day and email the buyer.
- **Residual:** Shared stock with TikTok Shop (T-14) can still oversell until synced.

### A6. Half of a mixed order arrives — P2
- **Move:** In-house package arrives; supplier package doesn't. Buyer files "item not received" for the whole order.
- **Weak spot:** No ship-by tracking per package; supplier timeline unknown.
- **Impact:** Chargeback for the full amount; FTC delay obligations for the unshipped part.
- **Policy:** Shipping: separate packages, each with tracking; supplier items use the time shown on the product page; delay notices per package.
- **Software:** Checkout branch: ship-by per package, "set ship-by" prompt for supplier packages, delay-notice tool, dispute flag.
- **Fix:** Done (checkout branch). Ops: answer disputes with per-package tracking.
- **Residual:** Supplier performance is outside FunkSquish's control — keep supplier-shipped items off sale until gate F-3 passes.

### A7. "My refund was short" — P2
- **Move:** Buyer returns an unopened item and receives the item price but not the sales tax.
- **Weak spot:** Returns said "refund of the item price" only.
- **Impact:** Keeping tax on a refunded sale is a tax-compliance and UDAP problem.
- **Policy:** Returns now: "refund of the item price and any sales tax charged on it"; original shipping not refunded for change of mind (approved R5).
- **Software:** Refund amounts are entered by the owner (PR #12) — no automatic tax calculation.
- **Fix:** Ops: refund line amount incl. tax from the order record. Accountant to confirm KY returned-goods deduction handling (Q-TAX-2).
- **Residual:** Manual arithmetic errors; consider an "item refund" helper later.

### A8. "Statutory rights beat your final-sale label" — P2
- **Move:** Buyer argues a defective blind-bag item must be refunded despite "final sale".
- **Weak spot:** None now — they're right.
- **Impact:** Refusing would breach implied warranty / UDAP.
- **Policy:** Returns: final sale is change-of-mind only; defective, unsafe, wrong items always covered; nothing limits legal rights.
- **Software:** n/a.
- **Fix:** Done.
- **Residual:** None.

### A9. Returned item is used, altered or substituted — P2
- **Move:** Buyer returns a cheaper knock-off squishy "unopened".
- **Weak spot:** No stated process for non-conforming returns.
- **Impact:** Loss of goods; dispute over refund refusal.
- **Policy:** Returns: if a return arrives opened/used/not ours, we tell you, send it back (you pay postage) or dispose of it; no change-of-mind refund; abandoned after 30 days. Terms: policy abuse can lead to declining future orders, without removing remedies on paid orders.
- **Software:** n/a.
- **Fix:** Ops: photograph returns on arrival (outer box, label, seal, SKU/tracking label) before opening; keep photos with the order.
- **Residual:** Proof quality; small claims risk is low-value.

### A10. Disputes a "cancellation fee" — P3
- **Move:** Buyer cancels before shipping and claims a fee was kept.
- **Weak spot:** None — policy says full refund incl. shipping and tax.
- **Impact:** Low.
- **Policy:** Returns + Order help: full refund before shipping.
- **Software:** `cancelOrder` refunds everything remaining.
- **Fix:** n/a.
- **Residual:** Race with shipping — see A11.

### A11. Cancel request arrives after the label is printed — P2
- **Move:** Buyer emails "cancel" an hour after the label was created but before carrier pickup.
- **Weak spot:** "Shipped" was undefined.
- **Impact:** Argument over whether a full refund or a return applies.
- **Policy:** Returns: "shipped" = handed to the carrier (supplier items: once the supplier sent it).
- **Software:** PR #12 marks shipped when tracking is entered — ops must enter tracking only after hand-off.
- **Fix:** Ops: void unused labels when a cancel arrives before hand-off.
- **Residual:** Supplier packages may be uncancellable once placed — disclose case by case.

### A12. Refund lands late on the card statement — P3
- **Move:** Buyer says refund "never arrived" 3 days after issue.
- **Weak spot:** Bank posting time.
- **Impact:** Duplicate refund via chargeback.
- **Policy:** Returns: bank may take a few more days; failed refunds re-sent another way.
- **Software:** PR #12 stores Stripe refund ids; give the customer the refund reference/ARN from Stripe.
- **Fix:** Ops: reply with the Stripe refund date and reference.
- **Residual:** Low.

## B. Shipping and fulfilment

### B1. Supplier misses the promised time — P1
- **Move:** Supplier ships 2 weeks late; buyer files a non-delivery dispute.
- **Weak spot:** No ship-by dates or delay-notice workflow existed.
- **Impact:** FTC Mail Order Rule violation (civil penalties), chargebacks.
- **Policy:** Shipping "If your order is delayed" now mirrors 16 CFR 435.2(b): notice before the ship-by date, free cancel, silence = consent only for a first delay ≤ 30 days.
- **Software:** Checkout branch: ship-by per package, overdue flag, delay-notice email with recorded consent type.
- **Fix:** Done (checkout branch).
- **Residual:** Gate F-3: no supplier-shipped products until a written supplier SLA exists.

### B2. "Ships in 2 business days" during a launch rush — P1
- **Move:** 300 orders in an hour; owner can't pack them in time.
- **Weak spot:** Busy periods aren't an excuse under the Rule.
- **Impact:** Mass delay notices required; complaints.
- **Policy:** Shipping: a busy launch or LIVE sale doesn't extend the ship-by date; product pages can show a longer time for a drop.
- **Software:** `processing_business_days` per product shows a longer time in the buy box before purchase.
- **Fix:** Ops: for big drops, set a longer processing time *before* the drop, or cap quantities.
- **Residual:** Owner capacity planning.

### B3. Tracking says delivered, buyer says no — P2
- **Move:** Buyer files "not received" with the card issuer.
- **Weak spot:** No stated approach; card networks favour cardholders without proof of delivery.
- **Impact:** Lost dispute + fee (Stripe dispute fee).
- **Policy:** Shipping: report within 14 days (approved S5); investigation; late reports keep legal rights.
- **Software:** Tracking stored per package (PR #12); disputes recorded with deadline (checkout branch).
- **Fix:** Ops: for orders above an owner-set value, buy signature confirmation (owner decision D-OPS-2).
- **Residual:** Some porch-theft losses are unavoidable cost of business.

### B4. Wrong address typed at checkout — P3
- **Move:** Buyer mistypes; package returns; buyer demands free reshipping.
- **Policy:** Shipping: reship for new postage or refund minus original shipping, within 5 business days of return (approved S6 + timing).
- **Software:** n/a.
- **Residual:** Low.

### B5. Carrier error returns the package — P2
- **Move:** Carrier mislabels and returns a correctly addressed package; FunkSquish charges for reshipping.
- **Weak spot:** S6 applied the customer-fault rule to every undeliverable package.
- **Impact:** Unfair charge; complaint.
- **Policy:** Shipping: our or carrier's mistake → free reship or full refund. (Needs owner approval — clarification of S6.)
- **Software:** n/a.
- **Residual:** Determining fault relies on tracking scans.

### B6. Territory address slips through Stripe — P2
- **Move:** Buyer in Puerto Rico checks out (Stripe lists territories under "US").
- **Policy:** Shipping: cancel and promptly refund in full; territories and freely associated states named.
- **Software:** PR #12 flags `restricted_destination`; checkout branch lists it in the owner's attention queue.
- **Fix:** Ops SLA: refund within 1 business day.
- **Residual:** Buyer disappointment; consider adding territories later (owner decision).

### B7. Washington, D.C. buyer — P3
- **Move:** D.C. buyer notes the policy only lists "50 states".
- **Weak spot:** Policy silent; code allowed D.C.
- **Policy:** D.C. now named. **Owner approval required** (S2 clarification).
- **Residual:** None once approved.

### B8. Inventory error: item listed but not in stock — P2
- **Move:** Catalog count wrong; orders accepted for stock that doesn't exist.
- **Weak spot:** Catalog counts updated at deploy, not live.
- **Impact:** Delay notices/refunds; false "in stock".
- **Policy:** Terms cancellation for stock errors with full refund.
- **Software:** PR #12 reservation ledger prevents overselling the catalog count, not a wrong count.
- **Fix:** Gate P-6: count physical stock before each drop; TikTok Shop allocation.
- **Residual:** Human counting errors.

### B9. Multiple packages, "you charged shipping twice" — P3
- **Policy:** Shipping: one shipping charge covers the whole order; never extra later.
- **Software:** One Stripe shipping rate per session (PR #12).
- **Residual:** None.

### B10. Product substitution — P2
- **Move:** Owner ships a different color because the ordered one ran out.
- **Policy:** Terms: no substitution without agreement.
- **Fix:** Ops: email for consent or refund that line.
- **Residual:** None if followed.

### B11. Tracking number never sent — P3
- **Move:** Shipping email failed (Brevo key expired); buyer files "not received".
- **Weak spot:** Brevo keys expire after 90 days unused.
- **Software:** PR #12 records failed emails and offers "Retry failed emails".
- **Fix:** Gate O-4: check the Brevo key and a test send on launch day and monthly.
- **Residual:** Monitoring is manual.

## C. Chargebacks and fraud

### C1. Stolen card, shipped to a reshipper — P2
- **Move:** Fraudster uses a stolen card for 10 limited-drop squishies.
- **Impact:** Chargeback (unauthorized) + lost goods + fee.
- **Policy:** Terms: we may cancel orders we reasonably believe are fraudulent; we share records with Stripe/issuer.
- **Software:** Stripe Radar (Stripe default); 3-D Secure supported; per-order quantity cap 10 (PR #12).
- **Fix:** Ops: review high-quantity or mismatched-address orders before shipping; cancel + refund if doubtful.
- **Residual:** Unauthorized-card chargebacks are usually lost unless 3DS-authenticated.

### C2. Duplicate payment for one cart — P2
- **Move:** Buyer double-clicks and claims two charges.
- **Software:** PR #12 creates the Stripe session with an idempotency key; one order per session; event de-duplication.
- **Policy:** Terms dispute section.
- **Residual:** Two separate sessions (two tabs) are two real orders — owner refunds one on request.

### C3. Refund race: owner refunds while Stripe's webhook arrives — P2
- **Move:** Not adversarial — a timing accident.
- **Weak spot:** PR #12 counted the refund twice (reproduced: $5 refund recorded as $10), lowering the "can still refund" cap.
- **Impact:** Owner can't refund the true remaining balance from the order page; accounting mismatch.
- **Software:** Fixed in checkout branch (`tests/audit/refund-race.test.ts`).
- **Residual:** None known.

### C4. "Item not received" while tracking shows delivery — P2
- see B3. **Software:** dispute deadline shown on the order; evidence checklist in `COMPLIANCE-LAUNCH-GATES.md` (gate C-7).

### C5. Friendly fraud after a refund — P2
- **Move:** Buyer gets a refund by email, then also files a chargeback.
- **Policy:** Terms: if we've already refunded, we tell the issuer.
- **Software:** Refunds and disputes both recorded on the order (checkout branch).
- **Fix:** Ops: respond to the dispute with the refund record.
- **Residual:** Dispute fee may not be returned (Stripe).

### C6. Quantity-limit circumvention with several orders — P2
- **Move:** Reseller places 5 orders of 10 to beat a "2 per customer" drop limit.
- **Weak spot:** Per-customer limits can't be enforced across orders in code.
- **Policy:** Terms: per-customer limits are stated on the product page before the drop; excess units across orders may be canceled and refunded in full.
- **Software:** Per-order cap 10/item only.
- **Fix:** Ops: review drop orders by name/address/email before shipping.
- **Residual:** Determined resellers using different identities.

### C7. Webhook outage — P2
- **Move:** Netlify function errors for 2 hours; paid orders not recorded.
- **Software:** Stripe retries for 3 days; "Check Stripe for missed orders" (PR #12).
- **Fix:** Gate C-5: reconcile daily during launch week.
- **Residual:** Owner must notice — consider an alert (proposal).

### C8. Forged webhook — P1
- **Move:** Attacker POSTs a fake `checkout.session.completed` to create a free order.
- **Software:** PR #12 verifies Stripe signatures on the raw body, rejects other-mode events, re-fetches the session from Stripe and requires `paid`.
- **Residual:** Webhook secret leakage — roll it (documented).

### C9. Tampered cart price — P1
- **Move:** Browser sends $0.01 for a $5 item.
- **Software:** PR #12 ignores client prices; tested in sandbox.
- **Residual:** None known.

### C10. Card-testing bots on checkout — P2
- **Move:** Bots create many sessions to test stolen cards.
- **Software:** Stripe Radar; no site-level rate limit on `startCheckout` (each call reserves stock for ~31 min — a bot could hold all drop stock).
- **Fix:** Proposal P-CK-5: rate-limit checkout starts per IP and cap reservations per IP for drops.
- **Residual:** Stock-hold denial of service during a drop until implemented.

### C11. Chargeback evidence missing — P2
- **Move:** Issuer asks for proof of terms shown and delivery.
- **Weak spot:** No record of policies shown at purchase.
- **Software:** Checkout branch stores policy versions on the session/order and shows a Terms notice above Stripe's Pay button.
- **Residual:** A checkbox (Stripe `consent_collection`) may be stronger — attorney question Q-TERMS-1.

## D. Privacy and personal information

### D1. Spoofed email asks for order history — P2
- **Move:** Someone emails from a look-alike address asking for a customer's address and orders.
- **Policy:** Privacy: we reply to the email on record; may ask for order number and buyer-only details; inbox access alone may not suffice. Order help: we only discuss an order with its buyer.
- **Fix:** Ops runbook (MASTER audit §7.4): never send addresses to a new address; reply only to the address on the order.
- **Residual:** A compromised inbox still passes — keep disclosures minimal.

### D2. Deletion request from a second email address — P2
- **Move:** Partner applied as `sales@`, asks from `owner@` to delete.
- **Software:** Deletion requests match the applied-with email only (hash).
- **Policy:** Partner notice: email "from the address you applied with".
- **Fix:** Ops: ask them to confirm from the original address, or verify by business details.
- **Residual:** Low.

### D3. Deletion request while a legal hold is active — P2
- **Weak spot:** "Delete and complete" deleted held applications (bug).
- **Software:** Fixed: completion refuses and logs when any match is on hold (`tests/partners/review-actions.test.ts`).
- **Policy:** Partner notice + Privacy: kept when required by law or an active legal dispute, and we say why.
- **Residual:** None known.

### D4. Abandoned partner application — P3
- **Software:** Automatic deletion after 24 months (12 if declined) — enforced daily.
- **Residual:** Gmail copies are manual (documented in PARTNERS.md).

### D5. Retained IP hash — P3
- **Policy:** Accurately described (kept with the application, deleted with it; IP never stored).
- **Residual:** Keyed hash of an IP is still pseudonymous data under some laws (Q-PRIV-2).

### D6. A child's name typed into a shared Squish Box link — P2
- **Weak spot:** Box names travel in the URL; Umami records URL query strings.
- **Impact:** Third-party analytics receive a child's name — COPPA-sensitive.
- **Software:** Fixed: analytics strip all parameters except utm_*; verified in Chromium on a production-context build.
- **Residual:** Netlify request logs still see the URL (disclosed).

### D7. Stripe session id in analytics — P2
- **Weak spot:** `/checkout/complete?session_id=…` would reach Umami.
- **Software:** Fixed: checkout and owner pages are never sent; private referrers dropped.

### D8. Breach of order records — P1
- **Move:** Owner passphrase phished; attacker exports customer names and addresses.
- **Weak spot:** Single-factor passphrase; no MFA; no export audit log.
- **Impact:** Breach notification duties (KRS 365.732 if covered data; other states vary); trust loss.
- **Policy:** Privacy: notices as the law requires.
- **Software:** Rate-limited login, 8-hour sessions, passphrase rotation signs out all devices.
- **Fix:** Proposal P-SEC-1: TOTP second factor before live orders; incident runbook (MASTER §7.6).
- **Residual:** P1 until MFA or equivalent exists for live order data.

### D9. Supplier misuses a customer's address — P2
- **Policy:** Privacy: suppliers get name, address and items only, and must use them only for delivery.
- **Fix:** Gate F-2: written supplier agreement with data-use clause.
- **Residual:** Enforcement depends on the contract.

### D10. Request conflicts with tax record-keeping — P2
- **Policy:** Privacy: legally required records kept, and we tell you.
- **Residual:** Retention period undecided (Q-RET-1).

### D11. Third-party tracker added later by mistake — P2
- **Software:** `tests/legal/policy-facts.test.ts` fails if code contacts an outside service the policy doesn't name, or sends an analytics event the policy doesn't describe.
- **Residual:** Scripts added through a CMS/tag manager outside the code wouldn't be caught (none exist).

## E. Children's products and safety

### E1. Small-parts toy sold without an online warning — P1
- **Weak spot:** Warnings lived in a collapsed section below the buy button; product cards and the mobile sticky bar offered direct purchase with no warning.
- **Impact:** 16 CFR 1500.20 requires the cautionary statement in advertising that offers a direct means of purchase; CPSC enforcement.
- **Software:** Fixed: warnings shown in the buy box above the button; cards and sticky bar hand off to the product page (`tests/shop/disclosures.test.ts`).
- **Residual:** Exact on-page placement/format should be confirmed by counsel (Q-SAFE-2).

### E2. Wrong age grade — P1
- **Policy:** Terms/FAQ: age grade exactly as on the label.
- **Software:** Publishing blocked without age grade (tests + catalog:check).
- **Residual:** Supplier labels themselves may be wrong — verify against the CPC.

### E3. Missing or forged Children's Product Certificate — P1
- **Software:** `catalog:check` requires a verified CPC, lab report, lab name, test date and tracking-label photo before a product can be published.
- **Fix:** Verify the lab on CPSC's accepted-lab list; reject CPCs without the required content.
- **Residual:** Forgery detection is manual; local check isn't enforced in CI (T-09).

### E4. Squishy contains water beads — P0 if sold
- **Impact:** Federal water-bead standard (16 CFR 1250.4, products made after March 12, 2026); 2026 recalls of squishy toys with water beads.
- **Software:** Partner form requires a water-bead answer; review flags it as a safety check.
- **Fix:** Gate P-3: no product with water beads unless test reports show compliance with 16 CFR 1250.4.
- **Residual:** Supplier misstatement — sample testing.

### E5. Leaking filling of unknown composition — P1
- **Policy:** Product care + Returns: stop using; keep away from kids and pets; don't mail back; replacement/refund.
- **Fix:** Section 15(b) assessment (MASTER §7.5): pattern of leaks = report within 24 hours of reasonably supporting information.
- **Residual:** Judgment on reportability → counsel.

### E6. Recall of a product we sold — P1
- **Weak spot:** No recall procedure; order records needed to contact buyers.
- **Policy:** Product care + Terms: we'll email buyers and post a notice.
- **Fix:** Recall runbook (MASTER §7.5); order retention long enough for recalls (Q-RET-1).
- **Residual:** TikTok Shop buyers contacted through TikTok.

### E7. Burn from microwaving a squishy — P2
- **Policy:** Product care follows the CPSC alert (never heat; 20-minute cool water; seek care).
- **Residual:** Misuse claims; product liability insurance (Q-INS-1).

### E8. Counterfeit squishies sold under our name — P2
- **Policy:** Order help: anyone selling before our announcement isn't us; Terms forbid claiming to be our reseller.
- **Fix:** Monitor TikTok Shop listings; report infringements.
- **Residual:** Brand protection is ongoing.

### E9. Child uses the Squish Lab/quiz — P2
- **Software:** No personal data leaves the browser; analytics events carry no answers; box names stripped.
- **Residual:** COPPA classification of the whole site (Q-COPPA-1).

### E10. Child signs up for drop alerts — P1 (when enabled)
- **Weak spot:** Email is personal information; no age screening.
- **Fix:** Gate M-2: attorney decision on COPPA approach before enabling newsletter/drop alerts.
- **Residual:** Open.

## F. Suppliers and partner applications

### F1. Supplier claims "CPC: yes for every product" falsely — P1
- **Software:** Answers are advisory flags only; nothing auto-approves.
- **Fix:** Require the actual CPC + lab report per SKU before ordering (COMPLIANCE.md).
- **Residual:** Document fraud.

### F2. Forged lab report — P1
- **Fix:** Check the lab on CPSC's accepted list; contact the lab to verify report numbers for first orders.
- **Residual:** Manual.

### F3. Unauthorized reseller of a brand — P2
- **Software:** Required "authorized channels" answers; "can't show authorization" flag.
- **Fix:** Written authorization before listing.

### F4. Counterfeit stock from a wholesaler — P1
- **Fix:** Buy samples first; compare to brand packaging; keep invoices (catalog requires invoice ref).

### F5. Applicant claims we "partnered" with them — P2
- **Policy:** Terms + partner page: applying creates no agreement; nothing agreed until both sign.
- **Residual:** Public misstatements by third parties.

### F6. Confidentiality dispute over shared pricing — P2
- **Weak spot:** Notice promised absolute confidentiality.
- **Policy:** Now: confidential, shared only with professional advisers or when the law requires.
- **Residual:** No NDA exists — written agreement stage.

### F7. Supplier asks to delete their application during a dispute — P2
- **Software:** Legal hold blocks deletion (fixed bug); exception recorded with reason.
- **Residual:** Counsel decides hold scope.

### F8. Application spam / form abuse — P3
- **Software:** Honeypot, signed tokens, rate limits, size caps (tested).
- **Residual:** Low.

### F9. Inappropriate use of applicant data for marketing — P2
- **Policy:** Never added to marketing lists.
- **Software:** No code path adds applicants to Brevo lists (notification only).
- **Residual:** Manual copy into a list would breach the notice.

## G. Marketing and promotions

### G1. Fake "was $12" price — P2
- **Impact:** FTC Guides Against Deceptive Pricing (16 CFR 233.1); KY UDAP.
- **Software:** `catalog:check` now blocks a compare-at price without `private_compare_at_basis` evidence.
- **Residual:** Evidence quality is owner-recorded.

### G2. False scarcity "Only a few left" — P2
- **Software:** Label only when tracked stock ≤ 3.
- **Weak spot:** Counts aren't live; TikTok Shop shares stock.
- **Fix:** Gate P-6.

### G3. Unverified testimonials or AI reviews — P2
- **Impact:** FTC Consumer Reviews and Testimonials Rule (16 CFR 465), civil penalties.
- **Software:** No reviews on the site.
- **Fix:** Gate M-5 before adding any reviews.

### G4. Supplier-gifted product shown on LIVE without disclosure — P2
- **Impact:** FTC Endorsement Guides; FTC staff: repeat disclosures during livestreams.
- **Policy:** FAQ: creators asked to disclose gifts/payments.
- **Fix:** Gate M-4: LIVE disclosure script.

### G5. Giveaway requiring purchase or shipping fee — P2
- **Impact:** Illegal lottery risk (prize + chance + consideration).
- **Policy:** Terms: no purchase necessary; no shipping-fee giveaways; written rules.
- **Fix:** Gate M-6: attorney rules template; check TikTok's promotion rules.

### G6. Restock alert arrives after sell-out — P3
- **Policy:** Form: general alert, not a reservation; Privacy: alerts go to the whole list.
- **Residual:** Customer disappointment only.

### G7. Marketing email to an unconfirmed address — P2
- **Software:** Brevo double opt-in; site stores nothing.
- **Residual:** Manual imports into Brevo would bypass consent.

### G8. Transactional email with promotions — P3
- **Software:** PR #12 order emails contain no promotions.
- **Fix:** Keep it that way (CAN-SPAM primary-purpose test).

### G9. Price shown on TikTok LIVE differs from the site — P2
- **Policy:** Terms: price errors → choice or refund; marketplace orders under marketplace terms.
- **Fix:** Ops: price changes go into the catalog first.

## H. Terms and policy interpretation

### H1. "By using the Site you agree" — P1
- **Weak spot:** Browsewrap assent is often unenforceable.
- **Fix:** Checkout branch: Terms notice above Pay + policy versions on orders; attorney: checkbox? (Q-TERMS-1).
- **Residual:** Open legal question.

### H2. Retroactive policy change — P2
- **Policy:** Terms: changes never apply to placed orders; order's versions govern; earlier versions on request.
- **Software:** `src/content/policies.ts` versions; stored on orders (checkout branch).

### H3. "Entire agreement" used against a customer — P2
- **Weak spot:** Introduced in the first rewrite, caught in the second pass.
- **Fix:** Removed.

### H4. "Abuse of our policies" used to deny refunds — P2
- **Fix:** Terms: never takes away remedies for a paid order.

### H5. "As is" applied to products — P1
- **Policy:** "As is" limited to Site tools; implied warranties for products preserved.
- **Residual:** Attorney review (Q-WAR-1).

### H6. Marketplace vs website rules conflict — P2
- **Policy:** Marketplace orders under marketplace terms; our policies for site orders. TikTok Shop's damaged-item window (90 days per its buyer page) differs — disclosed as "can differ".

### H7. Undefined "business day" / time zone — P2
- **Policy:** Defined: Mon–Fri excl. federal holidays, Eastern Time, example given.
- **Software:** Checkout branch computes the same rule.

### H8. "Prompt" refund undefined — P2
- **Policy:** "within 7 business days at the latest" for cancellations; 5 business days for returns.

### H9. Arbitration / class waiver ambiguity — P3
- **Policy:** States there's none (attorney may change).

### H10. Unapproved commitment slipped into a page — P2
- **Software:** `tests/legal/approved-commitments.ts` — every time commitment on policy/help pages must be listed with its source; banned absolute claims ("non-toxic", "100% safe", "COPPA-compliant"…) fail the build.

---

**Count:** 83 scenarios (A 12 · B 11 · C 11 · D 11 · E 10 · F 9 · G 9 · H 10).
