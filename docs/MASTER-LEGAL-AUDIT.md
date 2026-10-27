# FunkSquish — master legal, compliance and technical audit

_Audit date: **2026-10-27**. Prepared by Claude Code acting as a review team (consumer-protection, privacy,
children's-product, fraud/chargeback, supplier-risk, application-security and QA/accessibility perspectives). These are
analytical perspectives, **not legal advice and not professional credentials**. Nothing here declares any policy legally
compliant or approved._

Companion documents: `ADVERSARIAL-SCENARIOS.md` (83 scenarios) · `POLICY-COMPARISON.md` (every wording change) ·
`LEGAL-OPEN-QUESTIONS.md` (hand-off to attorney/accountant) · `COMPLIANCE-LAUNCH-GATES.md` (pass/fail gates) ·
`FINAL-AUDIT-SUMMARY.md` (results).

---

## 1. Scope, method and limits

**Baseline.** PR #11 (`legal/policy-accuracy`, head `95a8f22`) including its adversarial edits and
`docs/ADVERSARIAL-POLICY-REVIEW.md`. Checkout behavior from PR #5 (`feature/stripe-test-mode-b4`, `6e6fe40`, Stripe
sandbox) and PR #12 (`feature/stripe-live-readiness`, `5dba5f2`, locked live integration; contains PR #5). All three
branches sit directly on `main` (`c548e84`).

**Branches produced (nothing merged, deployed or switched on):**

| Branch | Based on | Contents |
| --- | --- | --- |
| `claude/upbeat-hawking-aonyc6` | PR #11 head | Policy rewrites, disclosures before purchase, analytics scrubbing, legal-hold fix, catalog gates, tests, these documents |
| `claude/upbeat-hawking-aonyc6-checkout` | PR #12 head | Checkout compliance fixes (refund race, ship-by dates, delay notices, disputes, policy versions, Terms notice, email wording). Still locked. |

**What was reviewed:** every page under `src/app`, all components with customer-facing copy, `src/content`, partner
storage/retention/deletion code, analytics, catalog scripts, `next.config.ts`, the Netlify scheduled function, all docs,
and PR #5/#12's checkout, order, webhook, notification and owner-admin code.

**Research method and limit.** Direct page fetching from this sandbox was blocked (the fetch tool could not resolve
hosts and shell egress to `ftc.gov`, `ecfr.gov` etc. returned proxy 403). Sources were therefore verified on
2026-10-27 through web-search retrieval of the **official pages listed below** (FTC, eCFR/Federal Register, CPSC, Kentucky
Legislature, IRS, ADA.gov, Stripe, Umami, TikTok Seller University). Where only secondary sources confirmed a point, it is
marked **UNVERIFIED**. Exact statutory wording should be read from the official text before relying on it.

## 2. Applicable rules — requirements vs. best practice

Legend: **Req** = legal/contractual requirement if applicable · **BP** = recommended practice · **?** = applicability
unknown → `LEGAL-OPEN-QUESTIONS.md`.

| Area | Applies to FunkSquish? | What it requires (summary) | Where we stand | Sources (verified 2026-10-27) |
| --- | --- | --- | --- | --- |
| FTC Mail, Internet, or Telephone Order Merchandise Rule, 16 CFR 435 | **Yes** once selling online | **Req:** reasonable basis for any stated ship time (30 days if none stated); delay option notice before the promised date with revised date or "unknown" and a cost-free way to cancel; silence = consent only for a definite delay ≤ 30 days; longer/indefinite/renewed delays need express consent or the order is cancelled; "prompt refund" = **7 working days** for card payments (2014 amendment) | Policy now mirrors the Rule; checkout branch tracks ship-by dates and sends recorded delay notices | [eCFR Part 435](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-435) · [FTC business guide](https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule) · [2014 amendments (FR)](https://www.federalregister.gov/documents/2014/09/17/2014-22092/mail-or-telephone-order-merchandise-rule) |
| FTC Act §5 (15 U.S.C. 45) — deception/unfairness | **Yes** | **Req:** truthful, non-misleading, substantiated claims; disclosures clear and conspicuous | Banned-claims test; disclosures moved above the buy button | [FTC Advertising & Marketing Basics](https://ftc.gov/business-guidance/advertising-marketing/advertising-marketing-basics) |
| Kentucky Consumer Protection Act, KRS 367.170 / 367.220 | **Yes** | **Req:** no unfair, false, misleading or deceptive acts; private action for personal/household purchases with ascertainable loss | Same posture as §5 | [KRS 367.220 (Justia)](https://law.justia.com/codes/kentucky/chapter-367/section-367-220/) — statute text to confirm on LRC site |
| FTC Endorsement Guides, 16 CFR 255 (2023) | **Yes** for LIVEs/creators | **Req/BP:** disclose material connections (gifts, payments) clearly; FTC staff: repeat disclosures during livestreams | No program yet; gate M-4; FAQ tells creators | [eCFR Part 255](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255) · [FTC FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking) · [Disclosures 101](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers) |
| FTC Consumer Reviews & Testimonials Rule, 16 CFR 465 (eff. Oct 21, 2024) | **Yes** if reviews used | **Req:** no fake/AI/insider reviews without disclosure, no buying reviews, no suppression of negative reviews; civil penalties | No reviews on site; gate M-5 | [FTC Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) · [eCFR Part 465](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465) |
| FTC Guides Against Deceptive Pricing, 16 CFR 233 | **Yes** if "was" prices | **BP (guides):** former price must be a bona fide price offered for a reasonably substantial period | Compare-at blocked without evidence | [eCFR Part 233](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-233) |
| COPPA Rule, 16 CFR 312 (amended; compliance date Apr 22, 2026) | **?** — depends on "directed to children"/"mixed audience" | **Req if covered:** notice, verifiable parental consent before collecting children's PI, security program, retention limits, separate consent for third-party disclosures | No PI collected today; email forms off; attorney Q-COPPA-1; gate M-2 | [FR final rule (Apr 22, 2025)](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) · [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) · [16 CFR 312.2](https://www.law.cornell.edu/cfr/text/16/312.2) · [FTC age-verification policy statement (Feb 2026)](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children) |
| CAN-SPAM, 15 U.S.C. 7701 et seq.; 16 CFR 316 | **Yes** for marketing email | **Req:** accurate headers/subjects, ad identification, valid postal address (PMB ok), working opt-out honored within **10 business days**, opt-out usable 30 days; transactional emails exempt from most rules but judged by primary purpose | Brevo footer has the PMB address; double opt-in; order emails have no promotions | [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) · [eCFR Part 316](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316) |
| Kentucky Consumer Data Protection Act, KRS 367.3611 et seq. (eff. Jan 1, 2026) | **Unlikely** (thresholds) | Applies at ≥100,000 KY consumers/yr, or ≥25,000 + >50% revenue from data sales; AG enforcement, 30-day cure, no private action | Voluntary rights process offered; Q-PRIV-1 | [KRS 367.3613 (LRC)](https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=56648) · [HB 15 (2024)](https://apps.legislature.ky.gov/law/acts/24RS/documents/0072.pdf) |
| Kentucky breach notification, KRS 365.732 | **?** — depends on data elements | Notice to affected residents without unreasonable delay for covered data (name + SSN/DL/account+code); consumer reporting agencies if >1,000 persons | Order records hold no SSN/DL/card data; plan in §7.6; Q-BREACH-1 | [KRS 365.732 (Justia)](https://law.justia.com/codes/kentucky/chapter-365/section-365-732) |
| CalOPPA, Cal. Bus. & Prof. Code 22575 | **Likely** (any commercial site collecting PI from CA residents) | **Req:** conspicuous privacy policy with categories, third parties, review/correction process, change process, effective date, **Do Not Track** response | Privacy draft covers each, incl. DNT/GPC section | [Statute (Justia)](https://law.justia.com/codes/california/code-bpc/division-8/chapter-22/section-22575/) · [CA AG guidance](https://oag.ca.gov/privacy/facts/online-privacy/privacy-policy) |
| Other state privacy laws (CCPA etc.) | **Unlikely** at current size | Revenue/consumer thresholds | Q-PRIV-1 | — |
| CPSIA / CPSA — children's products (≤ 12 yrs) | **Yes** | **Req:** third-party testing by a CPSC-accepted lab, Children's Product Certificate (furnished to retailers), tracking labels (by the manufacturer), lead/phthalate limits, ASTM F963 (16 CFR 1250) | Catalog gate requires verified CPC/lab/test date/tracking-label photo | [CPSC CPSIA](https://www.cpsc.gov/Regulations-Laws--Standards/Statutes/The-Consumer-Product-Safety-Improvement-Act) · [Tracking labels](https://www.cpsc.gov/Business--Manufacturing/Business-Education/tracking-label) · [ASTM F963 rule (FR 2024)](https://www.federalregister.gov/documents/2024/01/18/2024-00741/safety-standard-mandating-astm-f963-for-toys) |
| Water beads standard, 16 CFR 1250.4 | **Yes** if any product contains water beads | **Req:** size limits, acrylamide limit, warnings; products made after **Mar 12, 2026** | Partner screening asks; gate P-3 | [FR final rule (Dec 12, 2025)](https://www.federalregister.gov/documents/2025/12/12/2025-22643/safety-standard-for-toys-requirements-for-water-beads) · [CPSC guidance](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Water-Bead-Toys-Business-Guidance) |
| CPSC certificate eFiling (16 CFR 1110) | **Yes if importing** | **Req:** importers e-file certificate data since **July 8, 2026** (FTZ: Jan 8, 2027) | Q-SAFE-1 | [CPSC eFiling announcement](https://www.cpsc.gov/Newsroom/News-Releases/2026/CPSC-Implements-Mandatory-eFiling-for-Certificates-of-Compliance-Targeting-Dangerous-Foreign-Imports) · [eFiling FAQ](https://www.cpsc.gov/FAQ/eFiling-Frequently-Asked-Questions-FAQ) |
| Choking-hazard warnings in online ads, 16 CFR 1500.20 | **Yes** for small parts/balls/balloons/marbles | **Req:** the cautionary statement must appear in advertising that provides a direct means to purchase, including websites; conspicuous | Warnings now above the buy button; cards don't sell directly; placement details Q-SAFE-2 (exact Internet placement text **UNVERIFIED**) | [16 CFR 1500.20](https://www.ecfr.gov/current/title-16/chapter-II/subchapter-C/part-1500/section-1500.20) · [CPSC small parts](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Small-Parts-for-Toys-and-Childrens-Products) · [CPSC e-commerce violations](https://www.cpsc.gov/Business--Manufacturing/Online-Sellers-Safety-Guide/Common-Ecommerce-Safety-Violations) |
| Section 15(b) reporting, 16 CFR 1115 | **Yes** (retailers too) | **Req:** report within 24 h of information reasonably supporting a defect/substantial hazard; retailers may use §1115.13(b) | Runbook §7.5 | [eCFR Part 1115](https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1115) · [CPSC duty to report](https://www.cpsc.gov/Business--Manufacturing/Recall-Guidance/Duty-to-Report-to-CPSC-Rights-and-Responsibilities-of-Businesses) |
| CPSC squishy alert (Aug 5, 2026) | Guidance | Burn hazards; counterfeit squishies (water beads, small parts, lead, phthalates); buy from verified sellers | Product care page follows it | [CPSC alert](https://www.cpsc.gov/Newsroom/News-Releases/2026/Consumer-Safety-Alert-CPSC-Warns-Consumers-About-Fake-and-Counterfeit-Squishy-Toys-Reiterates-Warning-About-Serious-Burn-Hazards) |
| UCC implied warranties, KRS 355.2-314/-316; Magnuson-Moss | **Yes** | Merchantability implied unless properly disclaimed; MMWA bars disclaiming implied warranties if a written warranty is given | Terms preserve implied warranties for products; Q-WAR-1 | [KRS 355.2-316 (Justia)](https://law.justia.com/codes/kentucky/2011/355-02/355-2-316/) · [FTC warranty guide](https://www.ftc.gov/business-guidance/resources/businesspersons-guide-federal-warranty-law) · [15 U.S.C. 2301](https://www.law.cornell.edu/uscode/text/15/2301) |
| Fair Credit Billing Act / Reg Z 1026.13 | Customers' rights | Billing-error disputes for non-delivery/not as agreed within 60 days of statement; cannot be waived | Terms: disputes always available | [12 CFR 1026.13](https://www.consumerfinance.gov/rules-policy/regulations/1026/13/) |
| California Civ. Code 1723 | If CA buyers | Restrictive return policies must be posted; exemptions for "all sales final" etc. | 30-day policy posted | [Cal. Civ. Code 1723](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1723.) |
| California Prop 65 | **Likely exempt** | Businesses with < 10 employees exempt from warning duty | Q-P65-1 | [OEHHA FAQ](https://www.p65warnings.ca.gov/faq/businesses/are-any-businesses-exempt-proposition-65) |
| ADA Title III — web accessibility | **?** (courts split; no DOJ technical rule for private businesses) | **BP:** WCAG 2.x AA; DOJ says ADA applies to online goods/services | axe-core: no serious/critical issues on 13 key pages × 2 viewports | [DOJ guidance (2022)](https://www.ada.gov/resources/web-guidance/) |
| Record retention — IRS / Kentucky | **Yes** | IRS: generally 3 yrs; 6 if >25% under-reported; 7 for bad debt; KY: until KRS 139.620 assessment period ends (103 KAR 31:020; period **UNVERIFIED**) | Q-RET-1 | [IRS](https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records) · [103 KAR 31:020](https://revenue.ky.gov/DOR%20Training%20Materials/103%20KAR%2031.020.%20Records.pdf) |
| Kentucky assumed name, KRS 365.015 | **Likely** | Sole proprietor using a business name files with the county clerk | Q-ENT-1 | [Franklin Co. clerk (example)](https://franklincountyclerk.ky.gov/certificate-of-assumed-name) — **secondary** |
| Stripe Services Agreement / website requirements | **Yes** (contract) | Customer-service contact, refund/return, cancellation, shipping, privacy, card-security statement, promotion terms on the site; respond to disputes in 7–21 days | All present in drafts; dispute recording added | [Stripe website checklist](https://docs.stripe.com/get-started/checklist/website) · [Activation FAQ](https://support.stripe.com/questions/business-website-for-account-activation-faq) · [How disputes work](https://docs.stripe.com/disputes/how-disputes-work) |
| Card-network rules (Visa/Mastercard) | Via Stripe | Disclosure of refund policy etc. | Relied on Stripe's summary — network rule text **UNVERIFIED** | — |
| TikTok Shop seller policies | **Yes** for TikTok orders | Category qualification for toys (CPC ≤ 365 days, lab report, tracking label photo); 4-business-day after-sales review; buyer damaged-item claims up to 90 days | Website policies defer to TikTok for TikTok orders | [Toys requirements](https://seller-us.tiktok.com/university/essay?knowledge_id=6970324132480814&lang=en) · [Returns requirements](https://seller-us.tiktok.com/university/essay?knowledge_id=984433248438058&lang=en) · [Buyer return policy](https://shop.tiktok.com/us/return-policy) |
| Umami (processor) | **Yes** | Collects path/query, title, referrer, browser, OS, device, screen, language, country/region/city (IP not stored per Umami); `data-before-send`, `data-do-not-track` supported | Policy lists fields; hook strips params | [Umami tracker config](https://docs.umami.is/docs/tracker-configuration) · [Umami metrics](https://docs.umami.is/docs/metric-definitions) |

## 3. Policy-to-implementation matrix

Status words: **Yes / Partial / No / Process** (manual business process) · Tested: **Auto** (in `npm test`),
**Browser** (Playwright run, §6.4), **Manual**, **No** · Accurate: **Yes**, **UNVERIFIED**, or the problem.
"CK" = checkout branch.

| # | Policy statement | Implemented by | Impl. | Tested | Accurate | What can go wrong | Change made / needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Privacy/Terms are drafts, noindex | `LegalPage` default, `pageMetadata({noindex})`, `NOINDEX_PATHS` | Yes | Auto + Browser | Yes | Banner removed early | `POLICIES.status` + tests |
| 2 | Nothing for sale; checkout closed | `features.ts`, `purchasingEnabled`, `startCheckout` | Yes | Auto | Yes | Flag flipped by accident | Test asserts all switches off |
| 3 | Ship to 50 states, D.C., APO/FPO/DPO; not territories | Stripe `allowed_countries: ["US"]` + `isAllowedDestination` (PR #12) | Partial | Auto (PR #12) | Yes (D.C. added) | Stripe can't hide territories | Flag + attention list; refund SLA (F-6) |
| 4 | Shipping price shown before paying; no extra later | Stripe fixed shipping rates (PR #12) | Yes | Auto (PR #12 params) | Yes | Owner charges reshipping without cause | Policy limits reship charges to customer-caused returns |
| 5 | Own stock ships by end of 2nd business day (ET) | CK `ship-by.ts` sets `shipBy`; owner process | Partial | Auto (CK) | Yes | Owner misses the date | Attention list "overdue"; gate F-1 |
| 6 | Longer processing times shown on the product page before purchase | `salesTerms.processingBusinessDays` + buy box | Yes | Auto | Yes | Not passed into checkout lines | Proposal P-CK-4; owner sets supplier ship-by |
| 7 | Delay notice before ship-by date; consent rules | CK `sendDelayNotice` + email | Yes (CK) | Auto (CK) | Yes | Owner doesn't send in time | Overdue flag; runbook §7.1 |
| 8 | Refund canceled items within 7 business days | PR #12 `cancelOrder`/`refundOrder` | Yes | Auto | Yes | Owner delay | Same-day target |
| 9 | Tracking emailed when shipped | PR #12 `notifyShipped` | Yes | Auto | Yes | Brevo key expired | Retry button; gate O-4 |
| 10 | Damaged: ideally within 7 days; rights preserved | Policy + CK email | Yes | Auto (text) | Yes | Staff treat 7 days as cutoff | Runbook §7.2 |
| 11 | Lost in transit → replacement or refund | Process | Process | No | Yes | Owner refuses | Runbook §7.2 |
| 12 | Delivered-not-received: 14 days, investigate | Process | Process | No | Yes | Lost evidence | Keep tracking; disputes recorded (CK) |
| 13 | Undeliverable: customer-caused vs our/carrier error | Process | Process | No | Yes | Fault unclear | Use tracking scans |
| 14 | Change of mind: 30 days, unopened, buyer pays return | Process | Process | No | Yes | — | — |
| 15 | Refund within 5 business days of receiving a return | Process (owner refund button) | Process | No | Yes | Inspection stall | Restored R7 wording |
| 16 | Change-of-mind refund includes item sales tax | Process | Process | No | Yes | Manual math | Q-TAX-2 |
| 17 | Final sale only when shown before purchase | `salesTerms.finalSaleOnceOpened` + buy box; catalog gate | Yes | Auto | Yes | Not shown in cart | P-CK-4 |
| 18 | Non-conforming returns process | Process | Process | No | Yes | Disputed condition | Photo-on-arrival (F-4) |
| 19 | No substitution without agreement | Process | Process | No | Yes | — | — |
| 20 | Per-order quantity cap; per-customer limits stated | PR #12 `MAX_QTY_PER_ITEM = 10` | Partial | Auto (PR #12) | Yes | Cross-order circumvention | Owner review before shipping drops |
| 21 | Pricing errors: customer chooses; never pay more | Process | Process | No | Yes | — | — |
| 22 | Policy version that applied is kept | `src/content/policies.ts`; CK stores on session/order | Yes (CK) | Auto | Yes | Version not bumped on edit | Gate O-5 |
| 23 | Terms notice before paying | CK `custom_text.submit` | Yes (CK) | Auto | Yes | Attorney wants checkbox | Q-TERMS-1 |
| 24 | Disputes: records shared with Stripe/issuer | CK dispute records; Stripe Dashboard | Partial | Auto (CK) | Yes | Missed deadline | Attention list shows due date |
| 25 | Warnings/age grade exactly as label, shown before buying | `ProductShowcase` buy box; cards hand off | Yes | Auto + Browser | Yes | Wrong label data | Catalog gate; Q-SAFE-2 |
| 26 | Only sell with CPC + accepted-lab testing | `catalog:check` (local) | Partial | Manual | Yes | Not run before publish | Public-facts test in `npm test`; CI proposal P-CK-2 |
| 27 | Recall: email buyers, post notice | Order emails exist; process | Process | No | Yes | Retention too short | Runbook §7.5; Q-RET-1 |
| 28 | Analytics: no cookies, fields listed, params stripped, private pages skipped, DNT | `before-send.ts` + Umami attributes | Yes | Auto + Browser | Yes | Umami changes its fields | Re-check Umami docs yearly |
| 29 | Analytics events listed | `trackEvent` calls | Yes | Auto | Yes | New event added | Test fails until policy updated |
| 30 | Every outside service named | Code hosts | Yes | Auto | Yes | Script added outside code | — |
| 31 | Email lists: consent box, double opt-in, Brevo stores | `newsletter.ts`, `drop-alerts.ts`, Brevo DOI API | Yes | Auto | Yes | Manual imports | Process |
| 32 | Opt-outs within 10 business days | Brevo unsubscribe (auto); email requests manual | Partial | Manual (preview test Oct 24) | Yes | Manual email ignored | O-2 |
| 33 | Drop alerts: general, no per-product tracking | Single Brevo list, no attributes | Yes | Auto | Yes | — | — |
| 34 | Wishlists/box/quiz stay in browser | `local-store.ts` | Yes | Auto (unit) | Yes | Shared URL in host logs | Disclosed |
| 35 | TikTok clips load only on play | `ClipCard` | Yes | Manual (code read) | Yes | — | — |
| 36 | Partner data private, owner-only | Blobs + `requireReviewer` + noindex/no-store | Yes | Auto | Yes | Passphrase phished | P-SEC-1 |
| 37 | Partner retention 12/24 months, daily | `retention.ts`, `cleanup.ts`, scheduled function | Yes | Auto + preview run (PR #10) | Yes | Function stops | Red banner + alert email |
| 38 | IP code kept with application; IP never stored | `hashIdentifier`, `audit.ipHash` | Yes | Auto | Yes | — | — |
| 39 | Deletion within 30 days unless law/dispute | Requests workflow; legal hold | Yes (bug fixed) | Auto | Yes | — | Legal-hold refusal |
| 40 | Partner info confidential, advisers/law only | Process | Process | No | Yes | Copy into other tools | — |
| 41 | Orders private, owner-only | Blobs, owner area | Yes (PR #12) | Auto (PR #12) | Yes | No MFA | P-SEC-1 |
| 42 | Suppliers get name/address/items only, for delivery | Process + contract | Process | No | Needs contract | Over-sharing | Gate F-2 |
| 43 | Order retention [TBD], then delete | Nothing yet | No | No | Placeholder | Kept forever | P-CK-1; Q-RET-1 |
| 44 | Rights requests: verify, 30 days, appeal by reply | Process | Process | No | Yes | Spoofing | Runbook §7.4 |
| 45 | Breach notices as required | Process | Process | No | Yes | Slow response | Runbook §7.6 |
| 46 | Card numbers never seen | Stripe-hosted Checkout | Yes | Sandbox (PR #12) | Yes | — | — |
| 47 | Business mailing address in marketing emails | Brevo company profile | Yes | Manual (Oct 24) | Yes | — | — |
| 48 | Earlier policy versions on request | git history + `POLICIES` | Yes | Auto (dates) | Yes | Repo made private/deleted | Keep exports |

## 4. Findings register

Severity: **P0** critical (illegal or dangerous if live now) · **P1** high (material legal/financial exposure at launch)
· **P2** medium · **P3** low. Status: **Fixed** (committed and tested on a draft branch) · **Partial** · **Open**.

| ID | Sev | Finding | Status | Where |
| --- | --- | --- | --- | --- |
| L-01 | P1 | Delay obligations described vaguely; no system to know when ship-by dates pass | Fixed (text + CK tooling) | Shipping; CK `ship-by.ts`, `sendDelayNotice` |
| L-02 | P1 | Supplier processing times promised "on the product page and at checkout" with no field to show them | Fixed (product page); Partial (checkout lines) | `sales-terms.ts`; P-CK-4 |
| L-03 | P1 | Label warnings hidden in a collapsed section below the buy button; cards/sticky bar sold directly (16 CFR 1500.20) | Fixed (attorney to confirm placement) | `ProductShowcase`, `ProductCard` |
| L-04 | P1 | COPPA classification undetermined for a child-appealing toy site | Open | Q-COPPA-1, gate M-2 |
| L-05 | P1 | Browsewrap assent; no record of which policy version applied | Partial (CK notice + versions) | Q-TERMS-1 |
| T-04 | P1 | (PR #12) no ship-by/delay tracking | Fixed (CK) | CK |
| T-07 | P1 | (PR #12) owner area protecting customer addresses is single-factor | Open (proposal) | P-SEC-1, gate C-8 |
| PS-02 | P1 | No recall / Section 15(b) procedure | Fixed (runbook); adoption Open | §7.5 |
| B-02 | P1 | Sales-tax registration/Stripe Tax not set up | Open | Q-TAX-1, gate C-2 |
| L-06 | P2 | PR #11 changed owner-approved refund clock (R7) to an open-ended "receive and check" | Fixed | Returns |
| L-07 | P2 | 7-day damage window a hard cutoff on Shipping, FAQ and PR #12 email (contradicting Returns) | Fixed | Shipping, FAQ, CK email |
| L-08 | P2 | No path for latent defects | Fixed | Returns |
| L-09 | P2 | No remedy when a replacement isn't available | Fixed | Returns |
| L-10 | P2 | Change-of-mind refund silent on sales tax | Fixed (2nd pass) | Returns |
| L-11 | P2 | No process for opened/substituted returns | Fixed | Returns |
| L-12 | P2 | "Shipped" undefined for cancellations | Fixed | Returns |
| L-13 | P2 | D.C. and freely associated states not addressed | Fixed (owner approval) | Shipping, FAQ |
| L-14 | P2 | Mixed-order shipping charges unaddressed | Fixed | Shipping, Terms |
| L-15 | P2 | Lost-in-transit remedy unstated; first rewrite overlapped undeliverable | Fixed (2nd pass) | Shipping |
| L-16 | P2 | Carrier/our-error returns charged to customer | Fixed (owner approval) | Shipping |
| L-17 | P2 | Pricing-error clause one-sided | Fixed | Terms |
| L-18 | P2 | Quantity limits enforced in code but undisclosed | Fixed | Terms |
| L-19 | P2 | No promotions/giveaway terms | Fixed (text); Open (rules template) | Terms; Q-PROMO-1 |
| L-20 | P2 | Marketplace precedence ambiguous | Fixed | Terms, Shipping, Returns |
| L-21 | P2 | Chargeback handling and data sharing with issuers undisclosed | Fixed | Terms, Privacy |
| L-22 | P2 | Entire-agreement clause (first rewrite) could negate listing/email promises | Fixed (removed in 2nd pass) | Terms |
| L-23 | P2 | Fraud clause could be read to deny paid-order remedies | Fixed (2nd pass) | Terms |
| L-26 | P2 | Product page shipping/returns copy stale ("calculated at checkout", "will be confirmed") | Fixed | `ProductShowcase` |
| L-27 | P2 | Drop alert form implied per-product restock emails | Fixed | `DropAlertForm` |
| L-29 | P2 | Burn first aid incomplete vs CPSC alert; no recall notice process | Fixed | Product care |
| L-31 | P2 | No endorsement disclosure expectation for creators/LIVEs | Partial (FAQ); Open (gate M-4) | FAQ |
| L-33 | P2 | 14-day missing-package window could read as extinguishing rights | Fixed (2nd pass) | Shipping |
| PV-01 | P2 | Umami fields under-disclosed | Fixed | Privacy |
| PV-02 | P2 | Typed Squish Box name (possibly a child's) sent to Umami via URL | Fixed + browser-verified | `before-send.ts` |
| PV-03 | P2 | Owner/checkout URLs (references, Stripe session ids) would reach Umami | Fixed (+ referrers) | `before-send.ts` |
| PV-04 | P2 | QA: Next drops `beforeInteractive` on not-found pages → hook missing, raw URLs sent | Fixed (single loader) | `Analytics.tsx` |
| PV-06 | P2 | Partner notice implied the email address isn't stored | Fixed | Partner page |
| PV-07 | P2 | Partner notice promised absolute confidentiality | Fixed | Partner page, Privacy |
| PV-08 | P2 | Unconditional 30-day deletion promise vs legal holds | Fixed | Partner page |
| PV-09 | P2 | Brevo's role in order emails undisclosed | Fixed | Privacy |
| PV-10 | P2 | Sharing with issuers, advisers, insurer, CPSC, buyer of business undisclosed | Fixed | Privacy |
| PV-11 | P2 | TikTok Shop buyer data received for fulfilment undisclosed | Fixed (2nd pass) | Privacy |
| PV-12 | P2 | Rights-request verification/agents vague | Fixed (text) + runbook | Privacy; §7.4 |
| PV-13 | P2 | Order retention undecided; no deletion mechanism | Open | Q-RET-1; P-CK-1 |
| PV-14 | P2 | Supplier data-use limit needs contract | Open | Gate F-2 |
| PV-16 | P2 | "Forms meant for adults" not shown on the newsletter form | Open (COPPA decision) | Q-COPPA-1 |
| T-01 | P2 | Deletion requests deleted applications under legal hold | Fixed + test | `deletion-requests.ts` |
| T-02 | P2 | (PR #12) refund double-counted when webhook races the owner's refund | Fixed + test (CK) | CK `admin.ts` |
| T-03 | P2 | (PR #12) chargebacks not recorded | Fixed (CK) | CK `recordDispute` |
| T-05 | P2 | (PR #12) emails contradicted policies | Fixed (CK) | CK `notify.ts` |
| T-06 | P2 | (PR #12) no policy version / Terms notice at payment | Fixed (CK) | CK `stripe.ts` |
| T-08 | P2 | (PR #12) orders only in Netlify Blobs: no export/backup, no retention job | Open | P-CK-1 |
| T-09 | P2 | Catalog safety gate is local-only | Partial (public-facts test) | P-CK-2 |
| T-10 | P2 | No CI runs tests on PRs | Open | P-CK-2 |
| T-11 | P2 | Compare-at price without evidence | Fixed | `catalog:check` |
| T-14 | P2 | "Only a few left" relies on deploy-time counts; TikTok Shop not synced | Open | Gate P-6 |
| T-15 | P2 | Territory/oversold orders need manual refund with no SLA | Partial (attention list) | Gate F-6 |
| T-17 | P2 | (PR #12) Stripe Link shown despite card-only | Open (owner Dashboard) | Gate C-6 |
| T-18 | P2 | Brevo key expiry could silently stop order emails | Partial (failed status + retry) | Gate O-4 |
| T-19 | P2 | (PR #12) checkout has no per-IP rate limit; bots could hold drop stock | Open | P-CK-5 |
| PS-03 | P2 | Water-bead standard missing from compliance notes | Fixed | `COMPLIANCE.md` |
| PS-04 | P2 | No product liability insurance decision | Open | Q-INS-1 |
| PS-05 | P2 | Repacking may make FunkSquish the "manufacturer" | Open | Q-SAFE-1 |
| B-01 | P2 | Assumed-name certificate unconfirmed | Open | Q-ENT-1 |
| B-03 | P2 | Retention schedule (tax/accounting) undecided | Open | Q-RET-1 |
| M-02 | P2 | Reviews rule readiness | Open (no reviews yet) | Gate M-5 |
| L-25 | P3 | Order help stale/inaccurate lines | Fixed | Order help |
| L-28 | P3 | "One email" ambiguity | Fixed | `DropAlertForm` |
| L-30 | P3 | Statements that go stale after launch ("no recalls") | Fixed | Product care |
| L-32 | P3 | "As is" scope | Fixed (attorney review) | Terms |
| L-34 | P3 | Abandoned rejected returns | Fixed (owner approval) | Returns |
| PV-05 | P3 | No DNT/GPC disclosure (CalOPPA) | Fixed | Privacy |
| PV-15 | P3 | Provider data regions unverified | Open | Privacy TODO |
| T-12 | P3 | No CSP/HSTS headers | Open | P-CK-3 |
| T-13 | P3 | PR #5 docs include a Stripe test-mode shipping-rate id (identifier, not a secret) | Info | — |
| T-16 | P3 | Inline analytics values not escaped / id unvalidated | Fixed | `before-send.ts` |
| PS-06 | P3 | Prop 65 exemption unconfirmed | Open | Q-P65-1 |

**Counts:** P0 **0** · P1 **9** · P2 **57** · P3 **11** — total **77**. Fixed or partially fixed: **57**; open: **19**;
informational: **1**. (Counted from the rows above.)

## 5. Technical and operational audit

| Area | Finding | Evidence | Status |
| --- | --- | --- | --- |
| Stripe Checkout security | Hosted Checkout; card data never on our servers; card-only; live keys rejected in test and vice versa; live path needs code switch + production + env switch + live key + webhook secret + shipping rate | PR #12 `environment.ts`, `live.ts`, tests `live-readiness.test.ts` | Sound; Link still shows (T-17) |
| Webhook signatures | Raw-body HMAC via Stripe library, 5-min tolerance, 256 KB cap, mode check, 404 when locked | PR #12 `api/stripe/webhook/route.ts`, `webhook-route.test.ts` | Sound |
| Idempotency & races | Session idempotency key; one order per session (CAS); event de-dup; stock committed once; **refund race fixed** | PR #12 + CK `refund-race.test.ts` | Fixed |
| Inventory | 31-min reservations, CAS ledger, expiry release, `oversold` flag; counts from catalog JSON | PR #12 `inventory.ts` | Sound for single channel; TikTok sync open (T-14) |
| Refunds/cancellations | Owner refund/cancel with typed confirmation and Stripe idempotency; cancel refunds all & restocks | PR #12 `admin.ts` | Sound |
| Duplicate charges | Two tabs = two orders (by design); owner refunds on request | — | Accept |
| Chargeback evidence | **Added** dispute records with deadline; policy versions on order; tracking; email status | CK | Fixed |
| Audit logs | Order history (events, owner actions, refunds, delay notices, disputes); logs carry ids only | PR #12 + CK | Adequate; no immutable log |
| Customer order records | Netlify Blobs `stripe-live-orders` (refuses off production) | PR #12 | No export/backup/retention (T-08) |
| PII exposure | Return page shows items/totals only; owner email has no contact details; analytics scrubbed | PR #12 + legal branch | Sound |
| Auth/sessions | scrypt passphrase, 8-h HttpOnly/Secure/SameSite=Strict cookie, rate-limited login, actions re-check session | `security.ts`, `review-auth.ts`, tests | No MFA (T-07) |
| Partner retention/deletion | Daily cleanup, dry run, alerts, deletion requests; **legal-hold bug fixed** | tests/partners | Fixed |
| Notifications & retries | Claim-before-send, failed status, retry button; test mode silent unless enabled | PR #12 `notify.ts` | Sound; key expiry monitoring manual |
| Transactional vs marketing | Order emails transactional; lists separate; no promo content | PR #12 | Sound |
| Subscription consent records | Brevo stores DOI confirmation; form wording not versioned for email lists (partner form is versioned) | `newsletter.ts` | BP: add a version tag later |
| Rate limits / anti-bot | Partner form: honeypot, signed tokens, IP/email/global limits; email forms: honeypot; checkout: none | various | T-19 open |
| Supplier fulfilment | Manual placement; `awaiting_supplier`; ship-by set by owner (CK) | PR #12 + CK | Process + gate F-2/F-3 |
| Shipment tracking | Per-package tracking + email | PR #12 | Sound |
| Policy versioning & consent | `POLICIES` + version on order + Terms notice (CK) | legal + CK | Fixed (checkbox = Q-TERMS-1) |
| Product safety & recall | Catalog gates; warnings before purchase; runbook §7.5 | legal branch | Process adoption needed |
| Backups & recovery | `private/` encrypted backups only; Blobs not backed up | `BACKUP-RECOVERY.md` | T-08 open |
| Security headers | nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy; no CSP/HSTS | `next.config.ts` | T-12 open |
| Secrets | None in git (scan §6.3) | — | Pass |

### 5.1 PR #11 ↔ PR #12 interaction

- `git merge-tree` of this branch with PR #12: **no conflicts**. A trial merge of this branch with the checkout branch
  typechecks, builds, and passes **323/323** tests (one test needed a `server-only` mock, added).
- `src/content/policies.ts` is identical on both branches so the policy versions stored on orders match the pages.
- PR #12's own docs/FAQ are older than PR #11's; merge PR #11 first, then the checkout branch, so the newer wording wins.

## 6. Quality assurance performed (2026-10-27)

### 6.1 Automated (legal branch)
`npm test` **185/185 pass** (19 files; baseline was 118) · `npm run lint` 0 errors (1 pre-existing warning in
`opengraph-image.tsx`) · `npm run typecheck` pass (after build-generated route types) · `npm run build` pass ·
`npm run seo:check -- http://localhost:3100` **90 checks, all good** · `npm audit --omit=dev` 0 vulnerabilities.

### 6.2 Automated (checkout branch)
`npm test` **249/249 pass** (baseline 228) · typecheck pass · lint 0 errors · build pass · `npm audit --omit=dev` 0.

### 6.3 Secret scan
Regex scan of tracked files and of every added line in the audit commits for Stripe keys (`sk_/rk_/pk_live|test_`),
webhook secrets, Brevo keys (`xkeysib-`), AWS/Google/GitHub/Slack tokens, private keys, scrypt hashes and live session
ids. Result: only test fixtures (`whsec_FAKE…`, `aaaa…` hashes) and one Stripe **test-mode** shipping-rate id in PR #5's
docs (an identifier, not a credential). No `.env` files tracked.

### 6.4 Browser checks (Playwright/Chromium, local production build)
- 13 pages × desktop (1280×900) and mobile (375×812): HTTP 200, exactly one `h1`, no horizontal overflow, no console
  errors, **no serious/critical axe-core 4.10 violations**; Privacy/Terms `noindex`, Shipping/Returns indexable;
  all internal links on legal/help pages return 200.
- Analytics on a production-context build (Umami script stubbed): `/squish-box?name=Emma's birthday` → sent as
  `/squish-box`; `/?utm_source=tiktok&utm_campaign=launch&fbclid=x` → utm kept, `fbclid` dropped; `/partners/review` →
  **blocked**; hook defined before the tracker on every page. The first implementation failed this check on a
  not-found page (PV-04) and was replaced.

### 6.5 Not executed
Real payments, real emails, Netlify deploy previews, TikTok in-app browser, screen-reader walkthroughs, and any test
against live Stripe/Brevo/Netlify accounts (out of scope by instruction).

## 7. Runbooks

### 7.1 Delay notice (FTC Mail Order Rule)
1. Every business day, open **Orders**; anything "ships today" or "ship-by passed" comes first.
2. If a package can't ship by its date, before the date passes press **Send a delay notice**, enter the new date (or tick
   "can't give a date").
3. If the email fails, nothing changes — email the customer yourself using the same wording, or refund.
4. Customer replies "cancel" → refund the delayed items the same day (7 business days is the legal maximum).
5. Express consent needed (over 30 days, no date, or second delay) and no "yes" by the cancel-by date → cancel and refund.

### 7.2 Damaged, defective, lost
- Leaking/damaged/wrong: offer replacement or refund (customer's choice) incl. original shipping; don't ask for leaking
  items back; ask for photos but don't require them; late reports reviewed, not refused.
- Lost in transit (carrier loss) → replacement or refund; no carrier claim required of the customer.
- Delivered-not-received → ask the customer to check neighbors/carrier; open a carrier trace; decide within 5 business
  days; record the outcome on the order.

### 7.3 Chargebacks
1. A dispute appears on the order (and Stripe emails you). Note the evidence deadline.
2. Gather: order record (items, amounts, policy versions), tracking + delivery confirmation, emails sent (confirmation,
   shipping, delay), customer messages, refund records.
3. If you already refunded, say so. If the claim is fair, accept it — don't contest valid disputes.
4. Submit once, neutrally, before the deadline (Stripe allows one submission).

### 7.4 Privacy requests
1. Log the request date (30-day target). 2. Reply only to the email address on the order/application. 3. Before
disclosing an address or order history, ask for the order number and one detail only the buyer knows. 4. Agents: ask for
written permission from the person. 5. Delete what's not legally required; tell them what's kept and why (tax records,
legal hold). 6. Partner applications: use **Deletion requests** in the owner area. 7. Gmail copies: delete manually.

### 7.5 Product safety, recalls and Section 15(b)
1. Any report of injury, burn, choking, leaking filling, water beads or a strong chemical smell: stop selling that SKU
   (set it to draft), keep the customer's report and photos, ask the supplier for its test reports.
2. Search cpsc.gov/Recalls and SaferProducts.gov for the product.
3. If information reasonably supports that the product could create a substantial hazard or doesn't comply with a
   safety rule, **report to CPSC within 24 hours** (retailers may use 16 CFR 1115.13(b)); investigate no longer than about
   10 working days. When in doubt, ask counsel the same day.
4. Recall: email every buyer of the SKU from the order records; post a notice on `/product-care`; coordinate with the
   supplier/importer and TikTok Shop.

### 7.6 Security incident
1. Rotate the owner passphrase (signs out every device), `PARTNER_SECRET`, Stripe restricted key and webhook secret, and
   the Brevo key as relevant. 2. Check Netlify deploy history and function logs. 3. List what data was exposed (orders,
   applications). 4. Call counsel about notice duties (KRS 365.732 and customers' states). 5. Notify affected people
   when required; record what was done.

## 8. Proposals (separate, scoped — not in the legal PR)

| ID | Proposal | Why | Size |
| --- | --- | --- | --- |
| P-SEC-1 | TOTP second factor for the owner area (orders + applications) | Customer addresses behind a single passphrase (T-07) | Medium |
| P-CK-1 | Order retention job (minimize then delete per Q-RET-1) + encrypted CSV export/backup of orders | T-08, PV-13 | Medium |
| P-CK-2 | GitHub Actions: lint, typecheck, test, build on every PR | T-09/T-10 | Small (needs `workflow` permission) |
| P-CK-3 | CSP (report-only first) and HSTS headers | T-12 | Small–medium |
| P-CK-4 | Carry `finalSaleOnceOpened` and `processingBusinessDays` into checkout lines: show in cart, set supplier `shipBy` automatically | L-02, A2 | Small (after PR #11 merges) |
| P-CK-5 | Rate-limit `startCheckout` per IP and cap concurrent reservations per IP during drops | T-19 | Small |
| P-CK-6 | Alert email when the webhook fails or reconciliation finds missed orders | C7 | Small |
| P-CK-7 | Stripe `consent_collection.terms_of_service = "required"` if counsel prefers a checkbox | Q-TERMS-1 | Small (Dashboard ToS URL needed) |

## 9. Second independent adversarial pass

After the first rewrite, every revised policy was re-read from rendered text without relying on the first findings.
New issues found and fixed: entire-agreement clause (L-22, introduced by the first rewrite), fraud-clause overreach
(L-23), lost-in-transit/undeliverable overlap (L-15, introduced), late "delivered but missing" reports (L-33), sales tax
on change-of-mind refunds (L-10), TikTok Shop buyer data (PV-11), stale recall wording (L-30), private-page referrers in
analytics, and — from browser QA — the analytics hook missing on not-found pages (PV-04). Relevant tests were re-run
after each fix (185/185 legal branch; 249/249 checkout branch; 323/323 combined).

**Not claimed:** that legal risk is eliminated, that any policy is compliant, or that unexecuted tests passed.
