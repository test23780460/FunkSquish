# Policy comparison — PR #11 baseline vs. this audit branch

_2026-10-27 · "Original" = text at PR #11's head (`95a8f22`, `legal/policy-accuracy`). Where PR #11 itself had changed the
owner-approved text on `main`, that's noted. Full diffs: `git diff 95a8f22 -- src/app src/content src/components`._

**Approval key:** **O** = owner must approve · **A** = attorney should review · **—** = factual correction only (no new
commitment). Shipping and Returns were owner-approved on Oct 24, 2026; **every change to them below needs the owner's
renewed approval before merge** (they're live pages once merged).

## Shipping Policy (live page once merged)

| Topic | Original | New | Why | Risk addressed | Approval |
| --- | --- | --- | --- | --- | --- |
| Destinations | "all 50 states, including Alaska and Hawaii, and military APO/FPO/DPO … We don't ship to U.S. territories yet" | Adds **Washington, D.C.**; names territories and the Marshall Islands, Micronesia, Palau as not shipped | Checkout code (PR #5/#12) already allows D.C. and blocks the freely associated states, which aren't "territories" | Policy/code mismatch; D.C. buyers unsure | **O** (S2 clarification) |
| Territory orders | "we'll cancel that order and refund it in full" | "…and promptly refund it in full" | Ties to the refund deadline below | Stalled refunds | — |
| Shipping cost | "shown at checkout … total before you pay" | ~~One charge covers the whole order~~ → **Phase 2 (2026-10-27): cart-dependent** — one package and charge per place items ship from; mixed orders can cost more; every charge and the total shown before payment; **never extra shipping later**; items without confirmed rates aren't sold | Owner decision: mixed orders at launch (PR #16 implements it) | Surprise charges; guessing supplier costs | **O** (direction approved; wording to sign off) **A** (Q-SHIP-2) |
| Processing time | "within 2 business days of receiving the order (Monday–Friday, excluding U.S. federal holidays)" | Same promise, defined: by the **end of the second business day after the day we receive your paid order**, Eastern Time, with an example | "Within 2 business days" was ambiguous (does the order day count? which time zone?) | Disputes over late shipment; FTC reasonable-basis | **O** |
| Supplier/longer items | "must be disclosed before purchase on the product page and at checkout" (no field existed) | "its own processing time is shown on the product page before you buy, and that time applies instead" — now backed by `processing_business_days` | Promise had no implementation | Misleading ship-time claims (FTC 16 CFR 435) | — (implements the approved promise) |
| Delays | "we'll contact you promptly and no later than that date. When required by law, we'll seek your consent … We will not treat silence as permission to delay when the law requires express consent." | Spells out the FTC structure: notice **before the ship-by date**, free cancel; silence = consent only for a first delay ≤ 30 days; longer/unknown/renewed delays need a yes, otherwise cancel and refund; refunds within **7 business days at the latest** | Original was legally safe but not actionable or customer-readable | Mail Order Rule violations; chargebacks | **O · A** (Q-FTC-1) |
| Damaged | "email us within **7 days of delivery** with your order number and photos" | "please email us — **ideally** within 7 days … if you can, photos" | Contradicted the Returns page ("preferably", rights preserved) | Contradiction read against us | **O** |
| Lost in transit | (not addressed) | Carrier lost/destroyed → replacement or full refund, your choice; no carrier claim needed | "Item not received" disputes; FCBA billing error | — gap | **O** |
| Delivered-not-received | "email us within 14 days … appropriate replacement or refund; a carrier claim is not a condition…" | Same 14 days, plus "Reporting later doesn't take away any right you have by law" | Reporting window shouldn't extinguish legal rights | UDAP; card disputes | **O** |
| Undeliverable | "reship it once you pay for new postage, or refund the items minus the original shipping cost" | Same for address/missed-pickup; refund within **5 business days** after it reaches us; **our or carrier's mistake → free reship or full refund** | S6 applied customer-fault terms to every return-to-sender | Unfair charge | **O** (S6 clarification) |
| TikTok Shop | "TikTok Shop's shipping, tracking, and order rules also apply" | "…apply to that order" | "Also" left precedence unclear | Conflicting rules | — |

## Returns & Refunds Policy (live page once merged)

| Topic | Original | New | Why | Risk addressed | Approval |
| --- | --- | --- | --- | --- | --- |
| Refund clock (change of mind) | PR #11: "within 5 business days after we **receive and check** a voluntary change-of-mind return" (main/approved R7: "within 5 business days after we receive the return") | **Restored R7:** "within 5 business days after we receive the return" | PR #11 silently moved an owner-approved clock to an open-ended inspection | Stalling; unapproved change | — (restores approval) |
| Damage claims | "refund … after we approve a damaged-item claim" | Claims reviewed promptly ("usually within 2 business days"); refund within 5 business days of approval; item not required back unless asked | Approval had no time frame | Stalling | **O** ("usually" is non-binding) |
| Late / latent defects | "Missing this preferred reporting window or a photo does not remove statutory rights" | Same idea in plain words + "If a defect shows up later during normal use … contact us anyway: we'll review it fairly" | Leaks can appear after 7 days | Implied-warranty disputes | **O · A** (Q-WAR-1) |
| Replacement unavailable | (not addressed) | "If a replacement isn't available, we'll refund you in full" | Gap | Customer stuck waiting | — |
| Leaking items | "stop using any squishy that is torn…" | Adds: keep filling away from children/pets; don't mail back leaking items unless instructed | Safety | Injury, carrier hazmat | — |
| Change of mind | "for a refund of the item price" | "…**and any sales tax charged on it**"; defines "unopened" | Tax on returned goods | Over-collection of tax | **O · A** (Q-TAX-2) |
| Final sale | "opened mystery and blind-bag items aren't eligible … where clearly disclosed before purchase" | "applies only when the product page says 'Final sale once opened' before you buy" — backed by the new catalog flag and buy-box notice | Disclosure had no implementation | Unenforceable exclusion | — |
| Non-conforming returns | (not addressed) | ~~dispose after 30 days~~ → **Phase 2 (2026-10-27):** we explain why it doesn't qualify and offer to send it back at the buyer's expense; kept safe; never disposed of because time passed; unclaimed items handled as the law requires; items tied to disputes/chargebacks/legal claims kept; faulty/wrong items fall under the defect rules | Owner decision (D-RET-1) | Conversion claims; destroying evidence | **O** ✅ direction · **A** (Q-RET-2) — Returns kept **Draft** |
| Refund timing — cancellations | "refunded promptly within applicable legal deadlines" | "refunded promptly, and within **7 business days** at the latest" | Matches FTC "prompt refund" for card payments | Vague deadline | — (legal maximum) |
| Failed refunds | (not addressed) | Card closed → we contact you and refund another way | Gap | Lost refunds | — |
| How to start | "Email … with your order number" | "…from the address you ordered with" | Identity check | Spoofed requests | — |
| Canceling | "If your order hasn't shipped yet, we'll cancel it and issue a full refund" | Adds "including shipping and tax"; defines "shipped" (handed to carrier / supplier sent it) | Race between cancel and pickup | Disputes | **O** |
| TikTok Shop | "TikTok Shop's rules apply in addition to this policy" | "…under TikTok Shop's rules. Its time limits and who pays return shipping can differ" | Precedence; TikTok's damaged window and return-cost rules differ | Conflicting promises | — |

## Terms of Service (draft)

| Topic | Original | New | Why | Approval |
| --- | --- | --- | --- | --- |
| Scope | "By using the Site or placing an order, you agree" | Same, plus "Shipping Policy and Returns & Refunds Policy are part of these Terms" up front | Clear incorporation | **A** (Q-TERMS-1) |
| Who can buy | 18+ or parent/guardian | Same + "we currently sell and ship only to [Shipping Policy area]" | Destination restriction in contract | **A** (Q-AGE-1) |
| Payment | "charged when checkout is completed successfully" | Same in plainer words + owner decision on Link | Link appears despite card-only | **O** |
| Confirmation | "confirms we received your order and payment; we accept the order when we ship it" | Confirmation = received order and payment, not a promise every item ships; removed "accept when we ship" | "Accept on shipment" while holding money is confusing and doesn't change FTC obligations | **A** |
| Seller cancellation | Out of stock, address, fraud → refund | Adds listing error and published-limit cases; "canceling never changes the shipping timeframes for the rest of your order" | Prevents using cancellation to reset deadlines | **A** |
| Pricing errors | "may offer the item at the corrected price or cancel" | Customer chooses; no choice before the ship-by date → cancel and refund; never pay more after shipping | One-sided option removed | **O · A** |
| Quantity limits | "We may publish reasonable quantity limits before checkout" | Describes the per-order cap; per-customer drop limits stated on the product page; excess units across orders canceled and **refunded in full** | Code enforces 10/item/order; cross-order limits need a fair remedy | **O** |
| Substitutions | "won't substitute a materially different product without your agreement" | Never a different product, color or size without agreement; refund if unavailable | Tighter | — |
| Product info | "listings must accurately state…" (internal "must") | Commitment in customer terms; materially different item = wrong item under Returns | Clarity | — |
| Policy versions | "Changes don't affect orders you placed before the change" | Order governed by versions in effect at purchase; earlier versions available on request | Backed by `src/content/policies.ts` and (checkout branch) versions stored on orders | — |
| Promotions | (none) | Own written rules; no purchase necessary for giveaways; no shipping-fee giveaways | Stripe requires promotion terms; lottery law | **A** (Q-PROMO-1) |
| Marketplace | "also subject to that marketplace's terms" | Made under marketplace terms; our policies for site orders | Precedence | — |
| Disputes & fraud | (none) | Contacting us first is a request, not a requirement; records shared with Stripe/issuer; fraud can lead to declining orders **without removing remedies on paid orders** | Chargeback evidence; fairness | **A** |
| Safety/recalls | Follow labels | Adds: we'll tell buyers about safety issues or recalls | Recall duty readiness | **O** |
| Liability | "Site is provided 'as is'… doesn't limit our responsibility for products…" | "As is" limited to Site pages/tools; implied warranties and negligence liability for products expressly preserved | Overbroad disclaimer risk for children's products | **A** (Q-WAR-1) |
| Governing law | KY law; small claims; chargebacks | Same + "no arbitration agreement and no class-action waiver" | Transparency | **A** (Q-ARB-1) |
| General | (none) | Severability, no waiver, transfer with business (orders protected) | Standard | **A** |
| *(first draft only)* | — | An "entire agreement" bullet was added and then **removed** in the second pass | Could negate listing/email promises | — |

## Privacy Policy (draft)

| Topic | Original | New | Why | Approval |
| --- | --- | --- | --- | --- |
| Analytics fields | "page visited, the referring website, browser and device type, and country" | Adds page title, operating system, screen size, language, region and city (IP used, not stored per Umami) | Umami docs list these fields | — |
| Analytics URLs | (silent) | URL parameters stripped except utm_*; owner/checkout pages never counted; DNT respected | New code (`before-send.ts`) | — |
| Buy-link event | grouped under "TikTok links" | "clicks on 'Buy' links to TikTok Shop or another store" | Accuracy | — |
| Unsubscribe | "We process opt-outs promptly" | "within 10 business days, as the law requires, and usually much sooner" | CAN-SPAM | — |
| Drop alerts | "used only to tell you about a new drop or restock" | Alerts go to the whole list; no per-product tracking | Form promised per-product alerts | — |
| Shared links | "URLs may also appear in hosting or browser records" | Host receives the URL; not sent to analytics | Accuracy | — |
| Partner confidentiality | (silent) | Confidential; shared only with advisers or when law requires | Absolute promise on partner page was unkeepable | **O** |
| Partner email stored | Notice implied addresses aren't stored | States the email you type is stored with the application | Misleading wording | — |
| Retention exceptions | "only if the law requires it" | "…or there's an active legal dispute, and we record why"; deletion records 24 months after completion | Matches legal-hold feature | **O** |
| Orders | Order fields; supplier sharing | Adds disputes; supplier must use data only for delivery; Stripe keeps its own records; **TikTok Shop buyer data we receive to fulfil** | Gaps | **O** (supplier contract gate F-2) |
| Transactional email | "We email you about your order" | Sent through Brevo; Stripe may send a receipt | Processor accuracy | — |
| Purposes | 4 bullets | Adds recall/safety notices, disputes, legal claims, compatibility statement | Gaps | **A** |
| Sharing | Providers | Adds card issuers (disputes), advisers, insurer, authorities (e.g. CPSC), business transfer | Gaps | **A** |
| Regions | "may process … in the United States and other countries" | Same + Brevo example + owner TODO to confirm regions | Unverified | **O** |
| Children | "forms are intended for adults" | Forms "meant to be completed by adults"; purchases by adults per Terms; COPPA 2025 amendments in TODO | Consistency | **A** (Q-COPPA-1) |
| Rights | Access/correct/delete; verification; 30-day aim | Structured: agents, verification detail, extension notice, reconsideration by reply, non-discrimination | Process clarity | **O · A** (Q-PRIV-3) |
| Retention list | 4 bullets | Adds spam codes, analytics, Netlify logs; unsubscribe suppression | Completeness | — |
| Security | "notify you if the law requires it" | Notices to you and authorities as the law requires | Clarity | **A** (Q-BREACH-1) |
| DNT/GPC | (none) | DNT stops analytics; GPC has nothing to opt out of | CalOPPA disclosure | — |
| Changes | Material changes announced first | + earlier versions kept; no retroactive use without consent where required | Fairness | — |

## Other pages

| Page | Original | New | Why | Approval |
| --- | --- | --- | --- | --- |
| Partner notice | "kept confidential"; "never storing the addresses themselves"; "we'll delete it within 30 days" | Qualified confidentiality; accurate storage statement; deletion "unless the law requires us to keep it or it's part of an active legal dispute, in which case we'll tell you why" | Three unkeepable/misleading statements | **O** |
| Order help | "payment receipt and an order confirmation by email"; shipping info "will be on our shipping page before launch" | Confirmation from us; receipt may come from Stripe; shipping page exists; "we only discuss an order with its buyer" | Stale/inaccurate | — |
| FAQ | "email us within 7 days of delivery"; 50 states + APO; creators "email us" | "ideally within 7 days"; adds D.C.; partner page for suppliers; creators told gifts/payments must be disclosed | Contradictions; FTC endorsements | **O** (D.C.) |
| Product care | Burn advice "cool under running water"; "let us know" | CPSC alert detail (20 min, no ice, care for young children); water-bead warning; recalls section (email buyers, SaferProducts.gov) | CPSC alert; recall readiness | **O** (recall email promise) |
| Product page | "Shipping options, costs, and our returns policy will be confirmed before the shop opens. Shipping and tax will be calculated at checkout." | Ships-within-N line; shipping/tax shown at checkout; return summary; warnings/final-sale/processing time **above the buy button** | Stale + 16 CFR 1500.20 | **A** (Q-SAFE-2) |
| Drop alert form | "including if {product} becomes available"; "One email when…" | General alert, "not a reservation"; "An email when…" | Unsupported per-product promise | — |
| Checkout emails (checkout branch) | "email us within 7 days"; supplier items "follow the time shown on their product page" | "ideally within 7 days"; supplier time "shown … when you ordered"; promise of a delay email with refund option | Contradictions with PR #11 | **O** |

## Phase 2 additions (2026-10-27, PR #19)

| Policy | Change | Owner direction | Approval |
| --- | --- | --- | --- |
| Shipping | Per-package ship-by dates, tracking emails, delays (cancel one package: items + its shipping + tax), lost package → free replacement or full package refund, undeliverable refunds minus that package's shipping, APO/FPO/DPO supplier limits disclosed | Parts 2 and 5 | **O** wording sign-off |
| Returns | Damage review "aim" for 2 business days; cancel unshipped packages of a partly shipped order; status → **Draft** + noindex | Parts 4 and 5 | **A** before publishing |
| Terms | Cards and card wallets at launch (Decision tag removed); per-package shipping; pricing errors need express agreement, decline → cancel and refund, deadlines kept; limits stated (10 per item, 20 items) and excess units refunded incl. shipping | Parts 7 and 8 | **A** (still Draft) |
| Privacy | Supplier items sold only after a written agreement limiting address use to fulfilling the order; two-step sign-in before customer orders; card-only plan; Link sentence kept accurate either way | Parts 6 and 8 | **A** (still Draft) |
| FAQ, Order help | Per-package shipping and cancellation wording | Part 2 | — |
