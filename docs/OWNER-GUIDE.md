# FunkSquish owner guide

How to run FunkSquish from the private dashboard, without editing code. This is the
**authoritative** guide; older plans and checklists are listed in `docs/README.md`.

- **Where:** `funksquish.com/partners/review` (Deploy Previews have their own test copy).
- **Sign in:** your passphrase, then the 6-digit code from your authenticator app.
  Set up two-step sign-in first: Settings → Security & two-step sign-in. Keep the recovery codes offline.
- **Nothing here is public.** Owner pages are never indexed or cached, and every button checks that it's you.
- **Production vs previews:** each has its own data. Test products or orders on a preview never reach the real site.

The dashboard has ten sections: Overview, Products, Inventory, Orders, Suppliers, Fulfillment,
Shipping, Email & marketing, Analytics, Settings.

---

## Daily routine (Overview)

Open **Overview**. Every number comes from stored records — orders, the stock ledger, your products.
Nothing is estimated. Test-mode orders are labeled as test money.

1. **Set-up and warnings:** fix anything listed (two-step sign-in, unverified shipping, stale TikTok upload,
   overdue backup, supplier follow-ups).
2. **Orders that need you:** late packages, disputes, lost or returned packages.
3. **Shipping deadlines:** packages sorted by ship-by date.
4. **Stock to check**, **supplier orders to act on**, **emails that didn't send**.

---

## Products

### Add a product
1. **Products → New product:** name and category. It's a private draft.
2. **Basics:** summary, description, specs, tags (collections), Squish Lab textures, processing time,
   and final-sale terms (only if it's decided for this product).
3. **Variants, prices & costs:** one per color/size, each with its own SKU. You can enter:
   - **Selling price.** Tick **Price verified** once you've decided it.
   - **Was-price.** Only with its basis: when and where it really sold at that price.
   - **Unit cost and landed cost** (private). Tick **Cost checked** against the invoice or quote.
   - **Starting stock, packed weight and box size.**
   - **Who ships it and from where.** For a supplier item, add the supplier and the supplier's SKU.
4. **Photos & videos:** see below.
5. **Safety, compliance & confirmations:**
   - Copy the age grade and warnings **exactly from the label**.
   - Fill in the manufacturer/importer and country of origin.
   - Record the names of your compliance files: the Children's Product Certificate, the test report and lab,
     the test date and the tracking-label photo.
   - Keep the files themselves in your private folder; never upload certificates to the public site.
   - Tick the three confirmations: photos are real, warnings were checked, weights were measured.

### Photos and videos
- **Real photos of the real product only:** your own, or licensed in writing by the supplier.
  No stock photos, and no renders presented as photos.
- **Photos:** JPEG, PNG or WebP, up to 4 MB, at least 400 px on the short side.
  Picking photos on an iPhone converts them to JPEG automatically.
- **Videos:** MP4 or WebM, up to 4 MB (short clips; longer videos belong on TikTok).
- **Hidden data is removed** from photos before they're stored: GPS location, camera serial numbers.
- The first photo is the featured image. Reorder with ↑ ↓, or use **Make featured**.
- **Alt text:** describe what each photo shows. Screen readers read it out.
- **Privacy:** photos of drafts are private. A photo becomes public only while a published product uses it.
- **Cleanup:** **Products → Delete unused files** removes uploads that nothing uses. It never touches files on the website.

### The launch checklist
The panel on each product lists 12 items. **Publish** unlocks only when all of them pass:

- **Name & descriptions**
- **Variants & unique SKUs**
- **Verified prices**
- **Verified costs**
- **Real photos with alt text**
- **Age grade**
- **Warnings reviewed**
- **Maker & country**
- **Compliance documents** (verified CPC, test report, lab, date, tracking label)
- **Stock count:** a starting count for your own stock, or a linked supplier for supplier items
- **Fulfillment set-up**
- **Verified shipping:** weights, box sizes, and a verified rate for the place it ships from

Drafts can be saved at any stage.

### Publishing, changes and rollback
- **Publish to the website** puts the product in the shop right away. It shows "Coming soon" until
  purchasing is switched on in an approved launch PR.
- **Editing a published product doesn't change the website** until you press **Publish these changes**.
  The list shows "Unpublished changes".
- **Take off the website** makes it a draft again. **Archive** retires it but keeps its history.
  A never-published draft can be deleted.
- **Website catalog & rollback:** every publish makes a numbered release. If something goes wrong, roll back to
  an earlier one. The rollback is saved as a new release, so nothing is lost; the last 50 are kept.
- **Preview product page** shows the page as shoppers will see it.

### Spreadsheet import / export
- **Products → Import / export.** Same columns as `templates/catalog-template.csv`.
- **Check only** first. Imports arrive as drafts with the "verified" ticks off. Private columns go to private fields.
- **Export:** public columns only, or with private costs and suppliers. Keep the private file out of GitHub and email.
- **Copy the build-time catalog** if products were ever added with `npm run catalog:import`.
  Once you publish from the dashboard, its catalog replaces the build-time one.

---

## Suppliers

### Add a supplier
**Suppliers → Add a supplier.** Fill in only what the supplier has told you in writing; anything empty shows as **Missing**.
You can record:

- **Contacts and terms:** contacts, MOQ, samples, whether they dropship, processing time, shipping costs,
  tracking, returns, payment terms, product types and authorized sales channels.
- **Where the terms came from**, plus the agreement status and what it covers.

### Quotes, contact history and documents
- **Quotes:** written prices for products not linked yet. They feed **Compare**.
- **Contact history:** notes with follow-up dates. Overdue follow-ups appear on Overview.
- **Private documents:** agreements, price lists, catalogs, certificates and invoices
  (PDF, image scans or CSV, up to 4 MB).
  - Only you can download them, and only as files.
  - Word and Excel files are refused (they can carry macros); save them as PDF or CSV first.

### Link SKUs and compare
- **Link SKUs:** on a product's variant, choose the supplier and enter their SKU and your unit cost.
- **Compare:** terms side by side, and costs per SKU or quote.
  - Margins are **estimates** from your own price and cost entries; the page says which cost it used.
  - Type a planned price to compare quotes.

---

## Dropshipping (supplier-shipped packages)

A customer can buy your stock and supplier items in one checkout. Each origin is its own package,
with its own shipping charge, ship-by date, tracking and email. Nothing is ever ordered from a supplier automatically.

1. **Fulfillment → Place with supplier** lists what's waiting.
2. Open the order and place it on the supplier's site or by email.
   - Share only the name and address, and only with a supplier whose **signed agreement covers customer data**.
     The page warns you otherwise.
3. **Record supplier order:** pick the supplier and enter their order number (and their ship date if they gave one).
   - The same supplier order number can't be recorded twice, which guards against duplicate supplier orders.
   - Canceled or unpaid orders can't be placed.
4. **Supplier updates:** record that they confirmed it, that they're preparing it, or a problem
   (late, out of stock, wrong item…). Mark problems resolved. If they cancel, record it: the package goes back
   to "place with supplier".
5. **Tracking:** when they send it, enter it in **Mark shipped**. The customer gets the shipping email.
   A tracking number already used on another order is refused.
6. **Bulk:** with a signed agreement covering customer data, the supplier page can download a CSV of packages
   to place.
   - It contains only names, addresses, items and quantities (phone only if you choose).
   - Every download is logged.

Supplier APIs and automation are prepared but **off**. Each would need a signed agreement,
a reviewed integration, the supplier's credentials as Netlify secrets, and your approval.

---

## Inventory

**This site's count is the only real count.** Website orders take stock automatically.
TikTok Shop sales only count here once you record them.

- **Stock page:** for each item you can:
  - record a TikTok sale, a delivery, damage or a loss;
  - set a shelf count;
  - pause or resume it on the website;
  - mark it as listed on TikTok.
  - Warnings flag low stock (5 or fewer), sold out, oversold, and items not counted in 30 days.
- **TikTok LIVE:** start a LIVE to pause items on the website and record sales quickly; ending it reconciles.
- **TikTok, counts & restocks** page:
  - **Upload TikTok Shop orders:** the order export from Seller Center.
    - Each order line counts once, ever. Re-uploads and overlapping files are safe.
    - A cancellation puts the units back once.
    - Lines that would take stock below what website orders need are **held** for you.
    - Press **Check only** first. The column names follow TikTok's documented export; check them against
      your first real file.
  - **Upload shelf counts:** a `sku,count` sheet.
  - **Record a delivery:** adds the units and keeps a private record of supplier, invoice and unit cost.
  - **Supplier stock:** what the supplier last told you. "Out" or "discontinued" pauses the item on the website.
    Older than 7 days shows as stale.
- **Set TikTok Shop's own stock number** in Seller Center from the "free" count here, with a small buffer.
  Nothing here changes TikTok automatically.
- **Export:** Stock page → download current stock (CSV); Activity → download the stock history.

---

## Orders

- **Orders:**
  - **Search** by order number, customer, SKU, tracking number or supplier reference.
  - **Filters:** needs attention, to ship, supplier packages, refunded, disputed, canceled.
- **On an order:** each package has its ship-by date, tracking, and buttons for:
  - mark shipped;
  - a delay notice (send it before the ship-by date);
  - cancel or refund a package;
  - lost or returned, then reship or refund.
- **Refunds:** type the order number to confirm. Refunds go through Stripe; the customer gets one refund email
  per refund. Refunds made directly in the Stripe Dashboard aren't emailed by the site.
- **Cancel the whole order:** before shipping only. It refunds in full and emails the customer once.
- **Disputes** appear on Overview and the order. Respond in the Stripe Dashboard before the evidence date.
- **Emails:** confirmation, shipping, tracking update, delay notice, refund and cancellation. Each goes at most once,
  and test orders aren't emailed unless that's switched on.
  - **Retry failed emails** on an order resends only the ones that failed.
  - **Customer email previews** (Orders) shows every email with a made-up order.
- **Check Stripe for missed orders** records any paid checkout from the last 3 days that the webhook missed.

---

## Shipping rates

The rates customers pay come from `src/commerce/data/shipping-origins.json`.

Changing them is deliberately a reviewed step, because it changes what people are charged:

1. **Shipping → Draft changes:** edit an origin. You can set:
   - per-item or weight-tier rates;
   - processing time;
   - verification (date, who, where the evidence is — never in the future);
   - APO/FPO/DPO;
   - supplier agreement;
   - written confirmation for any $0 rate.
   Carrier and notes stay private. Supplier names are refused in public ids and labels.
2. **Preview an example cart.** Unverified rates are priced for checking, and flagged.
3. **Apply:**
   - download `shipping-origins.json`;
   - in GitHub, replace the file on a new branch and open a PR;
   - after it's merged and deployed, set `STRIPE_LIVE_SHIPPING_TABLE` (Production) to the new approval code shown.
   Live checkout stays closed until it matches.

Until an origin has verified rates, products shipping from it can't be checked out (the checklist says so).

---

## Email marketing

Two separate Brevo lists, both **double opt-in**: nobody is added until they tap the confirmation link.
The site never stores email addresses. Both forms are rate limited and have a hidden spam trap.

- **Launch list** and **Drop & restock alerts** both show on **Email & marketing**, with what each still needs.
  Both are off now.
- **Drop & restock alert drafts:** for real published products only.
  - The preview includes the unsubscribe link and your mailing address.
  - Sending is refused unless all of these are true:
    - the alert is true (for a restock: back in stock **and** buyable);
    - alerts are switched on;
    - sending is approved for Production (`DROP_ALERTS_SENDING=on`, plus `BREVO_DROPS_SENDER`);
    - two-step sign-in is set up;
    - you type SEND.
  - Each campaign goes once, and the same alert at most once a day. A failed send retries the same Brevo campaign.
  - **Never tested against the real Brevo account.** Send a first alert to a test list before your customers.
- **Per-product "tell me when" alerts** aren't built, on purpose: they need their own consent wording in the
  Privacy Policy first.

---

## Analytics

- **Facts** come only from verified orders: orders, units, paid, refunds, net revenue (after refunds and sales tax),
  shipping, tax, cancellations and disputes.
- **Estimates** use the costs you entered: product cost and gross profit before shipping labels and fees.
  If any sold unit has no cost, the estimate says it's incomplete.
- **Best sellers** and **no sales** (slow movers); **Download sales (.csv)** has no customer details.
- **Visitors** come from Umami (cookieless; owner and checkout pages are never counted). See them in the Umami
  dashboard, or add a read-only `UMAMI_API_KEY` for Production to show totals here.
- **Add-to-cart and checkout-start events are wired but off.** The Privacy Policy lists what analytics counts.
  Proposed sentence to add when approved:
  > "…starting checkout and adding items to the cart (counted without what you added or who you are)…"

  Then set `COMMERCE_EVENTS_ENABLED = true` in `src/components/analytics/track.ts` in the same PR.

---

## Backups

- **Settings → Backups → Download backup (.json)** holds:
  - products, private costs, suppliers, shipping drafts, catalog releases, restocks, alert drafts and the activity log.
  - Overview reminds you every 30 days.
- **Stored elsewhere** (export each separately):
  - **Orders and stock** live in the order store. Export them from Inventory (stock and history) and
    Analytics (sales CSV); Stripe keeps every payment.
  - **Photos and supplier documents** are in the private file store. Keep your originals.
- **Restore:** **Check only** first. Restoring adds anything missing. It only replaces changed records
  if you tick the box **and** type RESTORE, and it never deletes. A preview backup can't be restored into production.
- **Keep backups private** (encrypted drive or `private/`, never GitHub or email).
- `scripts/backup-private.sh` backs up the `private/` folder.

---

## Common errors

| You see | What to do |
| --- | --- |
| "This product was changed somewhere else…" | Another tab or device saved first. Reload and make your change again. |
| "Too many changes in an hour" | A safety limit. Wait a bit. |
| Publish button missing | The checklist names what's missing. Shipping is usually the last item (verified rates). |
| "Only JPEG, PNG or WebP…" | Re-save the photo as JPEG. |
| Supplier export "Not exported: …" | Mark the agreement as signed and covering customer data first. |
| TikTok upload: "Couldn't find these columns" | Use Seller Center's order export; the message names the missing columns. |
| "Held for you to check" (TikTok) | Count the shelf. The website may have sold those units. |
| Order email "failed" | Open the order → Retry failed emails. If it keeps failing, check Brevo (sender verified, key active). |
| Page stuck on "Loading…" | Reload. If it persists, check the Netlify status page. |
| Locked out (lost phone) | Use a recovery code. Last resort: `OWNER_MFA_RESET_ID` (`docs/OWNER-SECURITY.md`). |

---

## Launching safely

Use `docs/LAUNCH-CHECKLIST.md`. Every switch (purchasing, partner applications, email sign-ups, drop alerts)
is off in code and checked on every pull request. Turning one on is a launch PR you approve.

To undo a launch, set the switch back off in a PR, or redeploy the previous deploy in Netlify.
