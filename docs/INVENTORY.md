# Inventory — one shared stock for the website and TikTok Shop (managed by hand)

**Status (2026-10-27): built and tested in a draft branch (`claude/upbeat-hawking-aonyc6-inventory`, stacked on the
mixed-shipping branch). Nothing is switched on; website purchasing stays disabled.**

Owner decision: the website and TikTok Shop sell from the **same physical stock**. There's **no separate TikTok
allocation and no automatic TikTok sync**. The owner records TikTok sales and other stock changes on a private page,
and the website's available stock updates the moment each change is saved. No paid integration or external inventory
platform is used.

> **Manual updates are not instant, so this can't make overselling impossible.** Between a TikTok sale and you
> recording it, the website could sell the same unit. The LIVE routine below (pause on the website, then reconcile)
> keeps that window small. When it still happens, the order is flagged "oversold" for you to contact the customer and
> refund.

## Where

| Page | What it's for |
| --- | --- |
| `/partners/review/today` | Owner home: orders that need you, packages to ship (by ship-by date), stock to check, paused items, emails that didn't send, refunds and card disputes, a "record a TikTok sale" search box |
| `/partners/review/inventory` | Every real product and variant (drafts included): search by name/SKU, filters (needs attention, low, paused, on TikTok), a big **Sold 1 on TikTok** button per item, and everything else under "Update stock, pause, history" |
| `/partners/review/inventory/live` | TikTok LIVE mode: pick the items you'll show, pause them on the website, sell, then reconcile |
| `/partners/review/inventory/activity` | Every change in the last 14 days, newest first |

All are behind the owner sign-in (and, from the security branch, two-step sign-in), `noindex` and `no-store`.
On production they manage the **real** stock (even before website checkout opens). On previews and local dev they
manage the made-up TEST fixtures in a separate test store.

## The numbers on each item

| Shown as | Meaning |
| --- | --- |
| **On the shelf** | Units you physically have (or a supplier confirmed) that aren't promised to a TikTok buyer. Until you first change an item here, it's the catalog's count ("Using the catalog's count until you change it here"). |
| **Website orders — to ship** | Paid website orders not shipped yet. Still on your shelf, but promised. |
| **in checkout** | Shoppers on Stripe's payment page right now (held about 31 minutes, then released automatically). |
| **Free to sell** | On the shelf − website orders to ship − in checkout. What the website can still sell, and what you can safely sell on TikTok. |

## What changes the numbers

| Event | Who | Effect | Logged as |
| --- | --- | --- | --- |
| Sold on TikTok (1 tap, or a number) | You | On the shelf − N, immediately; the website can't sell those units any more | "Sold on TikTok" (source: You, or You (LIVE)) |
| Stock arrived | You | + N | "Stock arrived" |
| Damaged / Lost or missing | You | − N | with your note |
| Returned to stock | You — only after inspecting a returned item | + N | "Returned to stock" |
| Set count | You | Sets the number you physically counted | "Counted" (and the item's "last counted" date) |
| Correction (end-of-LIVE) | Reconciliation | ± the difference with TikTok Seller Center | "Correction" / "Sold on TikTok" with the reason |
| Website checkout started / paid | Website | Held, then "to ship" (no change to On the shelf) | — |
| Website package marked shipped | You on the order page | On the shelf − its units, **once** (updating tracking never deducts again; a replacement shipment deducts again) | "Website order shipped" with the order number |
| Website order or package canceled before shipping | You on the order page | "To ship" units become free again, once | — |
| Full refund before anything shipped (e.g. from the Stripe Dashboard) | Stripe webhook | Units become free again, once | — |
| Any refund after shipping | — | **No change** — put returned items back with "Returned to stock" after inspecting them | — |
| Undo (your own change, last 24 hours) | You | Reverses it | "Undo" (the original shows as undone) |

Safeguards:
- **Never below zero silently.** A change that would take the count below zero is refused with the current number and
  a pointer to "Set count".
- **Warns before taking website-promised units.** If a TikTok sale (or damage/count) would take units that website
  orders or open checkouts need, you see "Only F are free: S sold on the website and waiting to ship, H in shoppers'
  checkouts" and must confirm. If you confirm, any affected website payment is flagged "oversold" instead of shipping.
- **Double-taps record once.** Every button carries a one-time id; a repeated or retried tap shows "Already recorded".
- **Every change is atomic with the website's stock check.** It's the same record checkouts reserve from
  (compare-and-set), so a TikTok sale and a website checkout can't both take the last unit once the sale is saved.

## Warnings

| Warning | When |
| --- | --- |
| Website orders need N more than you have | Promised website units exceed the shelf (contact those customers) |
| On the website and TikTok with only N left — pause it | Item is listed on TikTok Shop (your toggle, a TikTok link in the catalog, or featured in the current LIVE), for sale on the website, not paused, and 5 or fewer free (tunable: **D-INV-1**) |
| Low / Sold out on the website | 3 or fewer free / none free |
| Units still reserved for canceled website orders | A canceled order's units weren't freed (fix with one button) |
| Paused on the website since … | Paused over 24 hours |
| No starting count / Never counted here / Not counted in 30 days | Reminders to count |

## TikTok LIVE routine (from your phone)

1. **Before going live:** `/partners/review/inventory/live` → tick the items you'll show → keep **"Pause these on the
   website during the LIVE"** ticked → **Start LIVE**. Only those items stop selling on the website; the rest of the
   store stays open.
2. **During the LIVE:** the featured items are at the top with a big **Sold 1 on TikTok** button. Tap it for every
   sale as you go (or enter a number). Mistakes: **Undo** in the item's history.
3. **After the LIVE:** in TikTok Seller Center, check how many of each item sold. Pack or set aside every TikTok
   order. Then **End LIVE & check the numbers**: enter TikTok's number of sales for each item (pre-filled with what you
   recorded) and, optionally, a shelf count (include units for website orders that haven't shipped). Differences are
   recorded with the reason "End-of-LIVE reconciliation", and the items the LIVE paused go back on sale (unless you
   untick it). A pause you set by hand stays.

If you sell on TikTok outside a LIVE, record each sale the same way (or pause the item on the website while it's
featured on TikTok).

## Data and limits

- Stored in the same private Netlify Blobs store as orders (`stripe-live-orders` on production, `stripe-test-orders`
  on previews), one record per variant. The activity log is one small record per change, kept by day.
- The variant record keeps its last 40 changes; the activity page shows 14 days. Older log records are kept but not yet
  shown or exported — **decision D-INV-2**: how long to keep stock history (it holds no customer data; order numbers
  only), and whether to add a CSV export for bookkeeping.
- **Product pages still show the catalog's stock label** ("In stock", "Only a few left"); the cart and checkout always
  use the live count (the cart says "Only 1 left" or "paused on the website" immediately). A live stock label on
  product pages is follow-up **INV-F1**.
- Supplier items use the same mechanism, with "On the shelf" meaning units the supplier has confirmed to you.

## Tests

`tests/inventory/` (29 tests): managed count replaces the catalog's; a TikTok sale immediately limits checkout and the
cart; damaged/lost/returned with reasons and an activity log; never below zero; website-promised units need
confirmation and late payments are flagged oversold; double-tap = one change; 10 concurrent TikTok sales on 5 units;
TikTok sales racing website checkouts for the last units; pause blocks only that item; LIVE pauses/resumes only its own
pauses and reconciles over- and under-recorded sales; shipping deducts once (tracking updates, duplicate webhooks), a
replacement deducts again; refunds never change stock, a full refund before shipping frees units once; package cancel
frees once; units stuck on canceled orders are found and released; every warning; owner actions refuse without a
session, accept only this mode's catalog items, and ignore outside redirect targets.
