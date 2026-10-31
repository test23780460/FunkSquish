# Website completion review — proposals for the owner (2026-10-31)

The website-completion branch made ordinary editorial and code fixes directly. The items below touch policy wording,
unresolved business decisions or paid services, so they are **proposed, not made**. Privacy, Terms and Returns stay
Draft and `noindex`; nothing here finalizes a policy. Not legal advice.

## 1. Business identity in the draft Privacy Policy and Terms

**Now:** both say the site is operated by "Travis Phillips, a sole proprietor doing business as FunkSquish"
(`siteConfig.legalOperator` in `src/lib/site.ts`, owner-approved 2026-10-24).

**Finding:** "doing business as" normally assumes the assumed-name certificate for "FunkSquish" has been filed with the
county clerk (KRS 365.015). That filing is still listed as open (`docs/LEGAL-OPEN-QUESTIONS.md`, B-01). Nothing on the
site mentions an LLC, and nothing should until one is actually formed.

**Proposed (pick one, with your attorney):**
- If the assumed-name certificate **is** filed: keep the current wording.
- If it **isn't** filed yet: file it before launch, or use "Travis Phillips, operating under the name FunkSquish" until
  it is.
- If an LLC is formed later: change `legalOperator` to the LLC's exact registered name, and update the Privacy and Terms
  "last updated" dates and versions in `src/content/policies.ts`.

## 2. Shipping Policy: "TikTok Shop orders show tracking in the TikTok app"

**Now:** the Shipping Policy's Tracking section says this as if TikTok Shop were confirmed. The FAQ says TikTok Shop is
"being explored". The same phrase on the Order help page (not a policy) was changed on this branch to "if we sell on
TikTok Shop, orders placed there show tracking in the TikTok app".

**Proposed policy edit:** "(If we sell on TikTok Shop, orders placed there show tracking in the TikTok app.)" Bump the
Shipping version and date in `src/content/policies.ts` when approved.

## 3. Damaged-item reporting window: consistent, no change needed

FAQ, Order help, Shipping, Returns and the order-confirmation email all say "ideally within 7 days of delivery", and
none of them treats 7 days as a cutoff. Returns adds that reporting later doesn't take away legal rights.

## 4. Netlify "Powered by Netlify" badge (paid-service decision)

On the live site, Netlify's free plan adds a badge to the bottom-right corner of every page (about 184 × 51 px). On the
free plan it can't be hidden. Netlify's own script says so. On phones it covered the product page's purchase bar.

**Done on this branch:** while the badge is on the page, the mobile purchase bar, the Squish Box "View box" button and
the footer's last row leave room for it. When the badge isn't there (for example on a paid plan), the layout is
unchanged.

**Decision:** keep the free plan and the badge, or upgrade the Netlify plan. Upgrading is a paid service, so it wasn't
done.

## 5. Launch-day copy now follows the catalog

Shop, home, Squish Lab, quiz, Squish Box and TikTok LIVE wording now switches automatically:

- **Only illustrated samples:** "preview" and "sample design" wording, as today.
- **Real products imported, purchasing off:** product wording, plus "Ordering isn't open yet".
- **Purchasing on:** product wording, with no "not for sale" notes.

Product badges still mark any remaining sample individually.

Still a deliberate launch-PR edit (not automatic):
- the "Coming soon" hero badge and marquee;
- the footer tagline;
- the launch steps on the home page;
- the FAQ's pending answers.

## 6. Still owner/legal decisions (unchanged by this branch)

- Privacy, Terms and Returns legal review (B6); retention period (B5).
- COPPA classification before any email list opens (Q-COPPA-1).
- Kentucky sales-tax permit and Stripe Tax registration.
- Real products: photos, label warnings, age grades, CPC/test reports, weights and verified shipping rates.
- Partner applications: legal sign-off, then `PARTNER_APPLICATIONS_ENABLED` for Production.
- Live payments: everything in `docs/STRIPE-PRODUCTION.md` ("Exactly what must happen before the first real payment").
