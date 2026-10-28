> **Update (2026-10-27):** a full adversarial legal audit builds on this review — start with
> `docs/FINAL-AUDIT-SUMMARY.md`. Several rows below were revised again (see `docs/POLICY-COMPARISON.md`).

# Legal document review — 2026-10-27

**Status: prepared for attorney and owner review. Nothing here is legal advice, and nothing is approved.**
Privacy Policy and Terms stay **Draft + noindex**. The Shipping and Returns policies are live (owner-approved
2026-10-24); the factual corrections below take effect only when this PR is merged.

`tests/legal/policy-facts.test.ts` now fails the build if the code starts doing something the policies don't
describe (a new analytics event or outside service) or if a corrected claim comes back.

## Plain-English comparison

### Privacy Policy (draft)

| Topic | Existing wording | Recommended wording | Why |
| --- | --- | --- | --- |
| Partner IP data | "we keep scrambled codes made from the sender's IP address and email address in counters that are deleted automatically after 2 days" | Rate-limit codes deleted after 2 days; **one IP code is also kept with the application and deleted with it**; the IP itself is never stored | **Inaccurate.** Every stored application has `audit.ipHash`, which lives as long as the application. |
| Service providers | Netlify and Google Workspace "and, once active, Brevo … and Umami" | Netlify, Google Workspace, Brevo, Umami, Stripe (once checkout opens), carriers and suppliers (for delivery), TikTok (only on play / TikTok Shop) | **Inaccurate.** Umami is live in production, and Brevo already sends owner notifications. Carriers, suppliers and TikTok weren't listed. |
| Analytics events | "counts a few actions, such as clicks on our TikTok links and completed email sign-ups" | Lists every counted action: TikTok clicks, quiz start/finish, Squish Box start, wishlist add/share, Squish Lab use, sign-ups, partner category | **Incomplete.** The code sends 11 event types. |
| TikTok clips | Not mentioned | Clips load nothing from TikTok until you press play; then TikTok's policy applies | Accurate description of `ClipCard`; required once clips are added. |
| Checkout & orders | "Orders will be processed by a third-party checkout provider … we'll update this policy" | Names Stripe; lists the order data we keep (name, email, shipping address, optional phone, items, amounts, Stripe references, tracking); says we never see full card numbers; sharing with suppliers only for delivery; **retention period left blank for a decision** | Matches PR #5's data model (`Order` type), Stripe Checkout (card details stay on Stripe) and the supplier-fulfilment path. |
| Transactional email | Not mentioned | Order confirmation, shipping/tracking and service emails aren't marketing and don't add you to a list | We'll send these; customers should know. |
| Rights requests | "ask … to correct or delete" | Same, plus how we verify the requester, a 30-day response target, and that legally required records (e.g. tax) may be kept | Gives an enforceable process (matches the partner deletion-request workflow). **Owner decision:** the 30-day target. |
| Children | Under-13 statement | Same, plus: forms are for adults; wishlist/quiz/box data never leaves the browser | Accurate, and relevant because squishies appeal to children. **Attorney question.** |
| Security / breach | Generic | Owner-only access behind sign-in, never in public code or logs; notify when the law requires | Accurate description; adds the breach-notification commitment the law requires anyway. |
| Changes | "We may update this policy" | Material changes announced on the page before they take effect | Consumer-protection good practice. |
| Not selling data | "We don't sell or rent" | Adds "or share it for targeted/cross-context behavioral advertising" | True (no ad pixels), and uses the term state privacy laws use. |

### Terms of Service (draft)

| Topic | Existing wording | Recommended wording | Why |
| --- | --- | --- | --- |
| Order acceptance vs. payment | "We accept it when we ship it or send a shipping confirmation" | Card is **charged when you place the order**; you get an order confirmation; we accept on shipping; any cancellation is refunded in full, including shipping | **Contradiction.** Stripe Checkout takes payment immediately, so the old text implied no charge before acceptance. |
| Payment methods | Not stated | Stripe; major credit/debit cards at launch | Matches the plan to start card-only. |
| Tax | "shown at checkout with shipping and any tax" | Shipping options/prices and any sales tax shown before you pay — **tax setup is an open decision** | Stripe Tax isn't configured yet (`automatic_tax` off). |
| Pricing errors | Contact before shipping, cancel for refund | Choose the correct price **or** cancel for a full refund | Clearer consumer choice. |
| Who can buy | Not stated | 18+ or parent/guardian places the order | Children's products. **Attorney question.** |
| Quantity limits | Not stated | We may limit quantities for drops | Needed for limited drops and LIVE sales. |
| Shipping/returns | Linked | Linked and stated to be part of the Terms | Makes the approved policies binding on both sides. |
| Partner applications | Not stated | Applying creates no partnership or agreement | Matches the partner page and the review workflow. |
| Liability | "isn't liable for indirect or consequential damages" | Same, but explicitly not limiting product responsibility, warranties or non-waivable consumer/product-safety rights | Avoids an overbroad limitation for a children's-product seller. **Attorney question.** |
| Disputes | Kentucky law | Kentucky law; contact us first; small claims and card chargebacks remain available; no arbitration clause | Consumer-friendly default. **Attorney question:** venue and arbitration. |
| Changes | "We may update these Terms" | Changes don't affect orders already placed | Fairness; avoids retroactive changes. |

### Shipping Policy (live — corrections need your approval via this PR)

| Topic | Existing wording | Recommended wording | Why |
| --- | --- | --- | --- |
| Shipping cost | "calculated at checkout from your package's weight and your address" | "The shipping options and their prices are shown at checkout" | **Inaccurate.** The checkout uses fixed Stripe shipping rates (`shr_…`), not weight/address calculation. **Owner decision:** flat rate(s) vs. calculated. |
| Processing time | "We pack and ship orders within 2 business days" | Items **from our own stock** ship within 2 business days; supplier-shipped items show their own time on the product page; mixed orders may arrive separately | **Promise the system can't keep.** Products have `fulfillmentSource: "supplier"`, and supplier lead times are unknown. The FTC Mail Order Rule requires a reasonable basis for any stated ship time. |
| Tracking | "You'll receive your tracking number by email from our checkout provider" | "We'll email you the tracking number when your order ships" | **Inaccurate.** Stripe sends payment receipts, not shipping/tracking emails. |
| Territories | "We don't ship to U.S. territories" | Same, plus: if checkout lets you pick a territory address, we cancel and refund in full | Stripe's "US" option includes territories, and hosted Checkout can't hide them (PR #5 flags these orders). |

### Returns Policy (live)

No factual contradictions found. One dependency: "Product pages will say when an item is final sale" — product
pages don't support a final-sale label yet. **Don't sell mystery/blind-bag items until that label exists.**

### Other pages

- **Order help:** "confirmation and shipping updates will come by email from our checkout provider" → "a payment receipt
  and an order confirmation by email, and we'll email your tracking number". Same reason as Tracking above.
- **FAQ:** "Orders ship within 2 business days" → our own stock ships within 2 business days; supplier-shipped items show
  their own time.
- **Partner page notice:** same IP-code correction as the Privacy Policy.

## Questions for an attorney

1. **Children's privacy (COPPA):** is the "general audience, not directed to under-13s" position sound for a squishy-toy
   brand with a quiz and playful design? Any age gate or parental-consent wording needed at checkout or sign-up?
2. **State privacy laws:** do Kentucky's consumer data protection law or any other state's law apply at our expected size?
   Is the rights-request process (verify, 30 days) adequate?
3. **Retention:** how long must order records (and refund/chargeback evidence) be kept for federal and Kentucky tax
   and accounting? Is the partner-application schedule (12/24 months; approved = while active) appropriate?
4. **Liability limits and warranties:** is the limitation enforceable and appropriate for children's products? Should we
   state an implied-warranty position? Is product-liability insurance needed before launch?
5. **Disputes:** keep Kentucky law with no arbitration clause, or add arbitration or a venue clause? Is a minimum purchaser age of 18 right?
6. **Mail Order Rule and marketplace terms:** are the shipping-time statements compliant for mixed stock and supplier
   fulfilment? Does TikTok Shop require any additional disclosures?
7. **Sales tax:** where must FunkSquish register and collect (Kentucky first; economic nexus elsewhere later)? This is
   probably a question for an accountant too.

## Owner decisions still open

- Order-record retention period (after attorney/accountant advice).
- Shipping-rate model (flat rate per order vs. weight-based) and the rates themselves.
- Sales-tax setup (Stripe Tax registration, or tax-inclusive pricing).
- 30-day response target for privacy requests.
- Shipping times for supplier-fulfilled products (or don't sell supplier-shipped items at launch).
- Final-sale labelling before selling mystery/blind-bag items.
