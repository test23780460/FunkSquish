# Launch copy — ready to use, no dates

Owner-facing text for announcing the launch. **Don't publish any of it until the launch date is real and
approved.** Replace `[DATE]` only with a confirmed date. Nothing here promises stock, shipping times or prices
beyond what the site and policies already say.

## Already automatic on the website

When the launch PR turns purchasing on, these switch by themselves (`src/content/launch.ts`):

| Where | Before launch | After launch |
| --- | --- | --- |
| Homepage badge / sticker / ribbon | "Coming soon" | "Now open" / "Shop now!" |
| Footer line | "…coming soon from a brand-new small business." | "…from a small business that loves them." |
| Page title and share image | "Squishies coming soon" / COMING SOON | "Squishies you'll want to squeeze" / NOW OPEN |
| Order help | "The shop isn't open yet" notice | Notice removed |
| Shop, product, quiz, Squish Box, Squish Lab, TikTok LIVE | Catalog-aware (samples vs real) | "Ordering isn't open yet" notes disappear |
| Product availability | "Coming soon" | In stock / Only a few left / Sold out (from live stock) |

## Still to update by hand at launch

- **FAQ answers marked "Coming soon"** in `src/content/faq.ts`, once each is decided:
  - payment methods;
  - when orders ship;
  - where we ship;
  - returns process.
  Use the wording in the final policies.
- **New Drops** (`src/content/drops.ts`): set the first drop's status and a confirmed `startsAt`.

## Homepage announcement (optional banner)

> **We're open!** The first FunkSquish squishies are here — squeeze-tested, label-checked and ready to ship.
> [Shop the collection]

## TikTok / social

**Teaser (before a date):**
> Something squishy is coming 👀 Our first collection is almost ready — follow so you don't miss launch day.

**Launch day:**
> WE'RE OPEN 🎉 The first FunkSquish squishies just dropped on funksquish.com — link in bio. Which texture are you? 🍓🫧

**LIVE:**
> Going LIVE at [TIME] with the first collection — squeeze tests, texture faves and your questions.
> Shop the items from the LIVE on funksquish.com (or TikTok Shop, once we're listed there).

## Launch-list email (send once, only to confirmed subscribers, from Brevo)

**Subject:** We're open — the first FunkSquish squishies are here

> Hi! You asked us to tell you when FunkSquish launched — today's the day.
> Our first collection is live at funksquish.com: [one line per product, only real ones].
> Thanks for being here from the very start.
> — Travis, FunkSquish

(Brevo adds the unsubscribe link; the mailing address goes in the footer.)

## TikTok LIVE page

Once LIVE shopping is real, change the TikTok LIVE page's "Can I shop during a LIVE?" answer to
describe exactly how ordering works (website, TikTok Shop, or both). Until then, leave it as it is.
