# FunkSquish

Pre-launch storefront for **FunkSquish** — colorful fruit slushies, jelly squishies, crunchy squishies and cute collectibles.
Live at https://funksquish.com (Netlify) · TikTok: [@FunkSquish](https://www.tiktok.com/@funksquish)

> ⚠️ **This repository is public.** Never commit supplier costs, invoices, certificates, API keys or internal notes. Those belong in the git-ignored `private/` folder or in Netlify environment variables.

Built with **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS 4**. The official round badge logo is used in the header, footer, favicons and share image; the mascot and collection characters are hand-coded SVG.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

Other checks:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home: hero, upcoming collections, why FunkSquish, TikTok LIVE, launch announcement |
| `/shop` | Preview catalog with search, collection filters and sorting (nothing purchasable) |
| `/shop/[slug]` | Product page with working color picker; quantity + purchase disabled |
| `/our-story` | About the business |
| `/tiktok-live` | TikTok LIVE info, planned stream types, schedule slot |
| `/faq` | Pre-launch FAQ; undecided answers are marked "Coming soon" |
| `/contact` | Email + TikTok contact |
| `/order-help` | How to get help with an order |
| `/product-care` | Care & safety tips (CPSC guidance: never heat squishies) |
| `/shipping`, `/returns` | **Draft** policies with owner decisions highlighted (noindex) |
| `/privacy`, `/terms` | **Draft** legal pages — owner review required (noindex) |
| `/newsletter/confirmed` | Shown after confirming the launch email (noindex) |

## Where to change things

| I want to… | Edit |
| --- | --- |
| Update the logo | The original is `assets/brand/funksquish-logo-original.webp`. Site copies live in `public/brand/` (round, transparent corners), favicons in `src/app/` (`favicon.ico`, `icon.png`, `apple-icon.png`), and the share-image copy in `src/assets/brand-logo-560.png`. Path is set in `src/lib/site.ts`. |
| Change email, TikTok link, nav links | `src/lib/site.ts` |
| Edit FAQ answers | `src/content/faq.ts` (remove `pending: true` once decided) |
| Announce a TikTok LIVE | `src/content/live-schedule.ts` |
| Edit collection names/descriptions | `src/commerce/categories.ts` |
| Add real products | Spreadsheet → `npm run catalog:import` — see `docs/CATALOG.md` |
| Edit preview sample products | `src/commerce/providers/preview.ts` |
| Shipping packages & weights | `src/commerce/shipping.ts` (all decisions `null` until made) |
| Turn on selling / email / analytics | `docs/LAUNCH-RUNBOOK.md` → `src/lib/features.ts` + Netlify env vars |
| Brand colors, fonts, animations | `src/app/globals.css` (`@theme` block) |

## Project structure

```
src/
  app/                 Routes (App Router), metadata, icons, sitemap, OG image
  commerce/            Public product types, catalog + availability rules, validation,
                       checkout provider interface (Shopify adapter, disabled), shipping config
  app/actions/         Server Actions: newsletter sign-up, checkout (both disabled)
  components/
    layout/            Header (mobile menu), footer, logo, page hero, transitions
    home/              Homepage sections
    shop/              Catalog, product card, gallery + zoom viewer, product page, purchase button
    cart/              Cart drawer + header button (only rendered when hosted checkout is on)
    analytics/         Umami loader + event helper (off until configured)
    tiktok/            Phone LIVE illustration, schedule
    illustrations/     Mascot + product SVG characters
    decor/             Bubbles, sparkles, waves
    ui/                Buttons, badges, headings, notices
    icons/             Inline SVG icons
  content/             Editable copy (FAQ, LIVE schedule, product care)
  lib/                 Site config, feature flags, SEO helpers, newsletter (Brevo)
scripts/               catalog:import / catalog:export / catalog:check, backup/restore (local only)
templates/             Blank catalog spreadsheet template
private/               GIT-IGNORED: your catalog sheet, costs, compliance files, internal checklist
docs/
  DEPLOYMENT.md        Netlify setup, DNS records, Free-plan credit budget, workflow
  ECOMMERCE-ROADMAP.md Platform comparison + how to switch on selling
  CATALOG.md           Product spreadsheet columns and launch gate
  COMPLIANCE.md        U.S. toy safety + TikTok Shop document requirements (research)
  NEWSLETTER.md        Launch email list (Brevo) setup
  ANALYTICS-SEO.md     SEO rules, Search Console, Umami analytics setup
  LAUNCH-RUNBOOK.md    Turning each feature on safely
  OWNER-DECISIONS.md   Policy decisions awaiting approval (shipping, returns, business details)
  BACKUP-RECOVERY.md   Encrypted backups of private/ and how to restore them
  STRIPE-TEST-SETUP.md Stripe Checkout TEST mode: setup, test plan, what's automated
  ORDER-MANAGEMENT.md  Order data model, fulfillment (in-house + supplier), storage options
  CHECKOUT-LAUNCH-READINESS.md  Shipping, tax, security and other blockers before real sales
```

## Design system (quick reference)

- **Colors:** `ink` (navy text), `royal` (primary buttons), `sky` / `sky-300` / `sky-200` / `ice` / `ice-50` (blues), plus one candy accent per collection: `berry`, `grape`, `peach`, `mint` (and `lemon` for notices).
- **Type:** Fredoka (chunky rounded headlines) + Nunito (body).
- **Shapes:** big rounded corners, pill buttons with a "candy" base shadow that squashes on press.
- **Motion:** float, bob, wobble, blink, marquee, page fade-in. Everything stops for users with *reduce motion* turned on.

## Honesty rules baked into the site

- Every sample product is labeled **Preview sample**; prices show **Price TBA**; purchase buttons are disabled.
- The email form is visibly disabled until a real provider is configured — no addresses are collected, and nothing is stored in the browser.
- Stock is only ever shown when a product is published, priced, tracked and actually sellable.
- Preview products and draft policies are kept out of search engines; no fake prices, ratings or reviews in structured data.
- The TikTok section never claims to be live and shows "No LIVEs are scheduled yet" until real dates are added.
- No unverified claims about safety certifications, shipping speed or product quality.

## Before launch

Follow `docs/LAUNCH-RUNBOOK.md`. The detailed internal checklist is in `private/LAUNCH-CHECKLIST.md` (local only, not in git).
