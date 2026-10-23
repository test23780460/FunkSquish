# Product safety & compliance (U.S.) — research notes

_Research summary from October 23, 2026. **This is not legal advice.** Confirm your obligations with the CPSC Small Business Ombudsman or a compliance professional before selling._

## Why this matters for squishies

- Squishy toys marketed for children are **children's products / toys**. Toys must comply with ASTM F963 (mandatory CPSC toy standard), CPSIA lead and phthalate limits, and tracking-label rules, and must be **tested by a CPSC-accepted third-party lab** and certified with a **Children's Product Certificate (CPC)**. ([Federal Register: ASTM F963 rule](https://www.federalregister.gov/documents/2024/01/18/2024-00741/safety-standard-mandating-astm-f963-for-toys))
- The CPC is issued by the **domestic manufacturer or importer** based on accepted-lab test results. Supplier in-house reports or non-accepted labs do not satisfy the requirement. ([Eurofins CPSIA guide](https://www.eurofins.com/textile-leather/articles/mastering-us-cpsia-certification-for-children-s-products-a-compliance-manager-s-guide/))
- **August 2026 CPSC alert:** the CPSC warned consumers about fake/counterfeit squishy toys (water beads, small parts, lead, phthalates, unknown fillings) and burn hazards from heating them. It reminds sellers that toys must show **manufacturer/importer identification, age grading, required warnings, and tracking information**, and that recalled products may not be sold. ([CPSC alert](https://www.cpsc.gov/Newsroom/News-Releases/2026/Consumer-Safety-Alert-CPSC-Warns-Consumers-About-Fake-and-Counterfeit-Squishy-Toys-Reiterates-Warning-About-Serious-Burn-Hazards))
- 2026 recalls include several **squishy buns containing water beads** and a squeeze toy recalled for asbestos in its sand filling — check the [CPSC recalls list](https://www.cpsc.gov/Recalls) for anything you plan to stock.
- **If you import directly:** CPSC began enforcing electronic certificate filing (eFiling) for CPC/GCC products on July 8, 2026 — importers must file certificate data before goods enter the U.S. ([PPC Land summary](https://ppc.land/tiktok-shop-sellers-face-shipment-seizure-risk-under-new-cpsc-filing-rule/)). If you buy from a U.S. wholesaler/importer, they are typically the importer of record — get their CPC.

## TikTok Shop (U.S.) — documents for non-electronic children's toys

From TikTok Shop's seller university page ([source](https://seller-us.tiktok.com/university/essay?knowledge_id=6970324132480814&default_language=en)) — documents "may be required," and TikTok decides category approval:

| You are a… | Documents |
| --- | --- |
| **Reseller** (buying finished, labeled products) | CPC issued within the last 365 days · Purchase invoice within the last 365 days, quantities matching what you'll sell · Product photos showing the tracking label |
| Manufacturer / importer / repacker | CPC (≤365 days) · CPSC-accepted lab test report (≤365 days) · Product photos with tracking label |

**Repacking** squishies (e.g. into your own mystery bags) may put you in the stricter group — ask before planning that.

## What to request from every supplier (before paying)

- [ ] Children's Product Certificate naming the exact item/model, the CPSC-accepted lab, and test dates
- [ ] The lab test report (ASTM F963 + CPSIA lead/phthalates; water-bead and small-parts results where relevant)
- [ ] Photo of the permanent tracking label and the retail packaging (age grading, warnings, manufacturer/importer name)
- [ ] Country of origin, materials and filling type
- [ ] Commercial invoice with your business name and quantities
- [ ] Confirmation the product is not subject to a recall

Record each item in the `private_*` columns of `private/catalog.csv`. `npm run catalog:check` blocks publishing a product until its CPC, test report, lab, test date, tracking-label photo, invoice and cost are recorded and marked `verified`.

## What the website does

- Product pages show age grading, warnings, manufacturer/importer and country of origin **only from your catalog data**, never guessed. Empty = "To be confirmed".
- General care tips (never heat or microwave, stop using damaged squishies) follow the CPSC alert and appear on every product page and `/product-care`.
- The site never displays certification claims. Certificates stay private (`private/`), shared with TikTok Shop or customers on request.
- **Never create, edit or "fill in" certificates.** Only use documents issued by the responsible manufacturer/importer and lab.

## Other launch items to confirm with an advisor

- Business registration, EIN, and seller's permit / sales-tax registration in your state.
- Marketplace facilitator rules (TikTok Shop generally collects tax on its sales; website sales may need your own collection).
- Product liability insurance (often required by marketplaces as you grow).
- Advertising to children (FTC/COPPA) for any kid-directed marketing or email list.
