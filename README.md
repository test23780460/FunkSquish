# FunkSquish

Pre-launch storefront for **FunkSquish** — colorful fruit slushies, jelly squishies, crunchy squishies and cute collectibles.
Live domain (once connected): https://funksquish.com · TikTok: [@FunkSquish](https://www.tiktok.com/@funksquish)

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
| `/privacy`, `/terms` | **Draft** legal pages — owner review required |

## Where to change things

| I want to… | Edit |
| --- | --- |
| Update the logo | The original is `assets/brand/funksquish-logo-original.webp`. Site copies live in `public/brand/` (round, transparent corners), favicons in `src/app/` (`favicon.ico`, `icon.png`, `apple-icon.png`), and the share-image copy in `src/assets/brand-logo-560.png`. Path is set in `src/lib/site.ts`. |
| Change email, TikTok link, nav links | `src/lib/site.ts` |
| Edit FAQ answers | `src/content/faq.ts` (remove `pending: true` once decided) |
| Announce a TikTok LIVE | `src/content/live-schedule.ts` |
| Edit collection names/descriptions | `src/commerce/categories.ts` |
| Edit preview sample products | `src/commerce/providers/preview.ts` |
| Turn on selling / email sign-ups | Only after connecting a provider — see `docs/ECOMMERCE-ROADMAP.md`, then `src/lib/features.ts` |
| Brand colors, fonts, animations | `src/app/globals.css` (`@theme` block) |

## Project structure

```
src/
  app/                 Routes (App Router), metadata, icons, sitemap, OG image
  commerce/            Provider-agnostic product types, catalog layer, preview data
  components/
    layout/            Header (mobile menu), footer, logo, page hero, transitions
    home/              Homepage sections
    shop/              Catalog, product card, product page pieces, purchase slot
    tiktok/            Phone LIVE illustration, schedule
    illustrations/     Mascot + product SVG characters
    decor/             Bubbles, sparkles, waves
    ui/                Buttons, badges, headings, notices
    icons/             Inline SVG icons
  content/             Editable copy (FAQ, LIVE schedule)
  lib/                 Site config, feature flags, helpers
docs/
  DEPLOYMENT.md        Vercel + Squarespace DNS (keeps Google Workspace email safe)
  ECOMMERCE-ROADMAP.md How to switch on real products, checkout and email
```

## Design system (quick reference)

- **Colors:** `ink` (navy text), `royal` (primary buttons), `sky` / `sky-300` / `sky-200` / `ice` / `ice-50` (blues), plus one candy accent per collection: `berry`, `grape`, `peach`, `mint` (and `lemon` for notices).
- **Type:** Fredoka (chunky rounded headlines) + Nunito (body).
- **Shapes:** big rounded corners, pill buttons with a "candy" base shadow that squashes on press.
- **Motion:** float, bob, wobble, blink, marquee, page fade-in. Everything stops for users with *reduce motion* turned on.

## Honesty rules baked into the site

- Every sample product is labeled **Preview sample**; prices show **Price TBA**; purchase buttons are disabled.
- The email form is visibly disabled and has no submit target — no addresses are collected.
- The TikTok section never claims to be live and shows "No LIVEs are scheduled yet" until real dates are added.
- No unverified claims about safety certifications, shipping speed or product quality.

## Before launch

See the checklist in `docs/ECOMMERCE-ROADMAP.md` and finalize the draft legal pages.
