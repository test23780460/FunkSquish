# Order management — design (test mode now, launch-ready shape)

Code: `src/commerce/orders/`. Everything here runs **only in Stripe test mode** today.

## Core rules

1. **A redirect is not proof of payment.** An order is created only after the Checkout Session is **re-fetched from Stripe** and its `payment_status` is `paid` (or later via `checkout.session.async_payment_succeeded`).
2. **Exactly once.** The same step runs from the signed webhook, Stripe's retries, and the return page, possibly at the same time. It is idempotent: one order per Checkout Session (order key = session id, deterministic order number), stock committed once, each Stripe event id recorded and skipped if already processed.
3. **Never auto-pay suppliers.** Supplier-shipped items are marked `awaiting_supplier`; the owner places the partner order manually.
4. **Customer data stays private.** Orders live in private server storage — never in GitHub, browser bundles, or ordinary logs (logs carry only event ids, types and order numbers).

## Data model (`src/commerce/orders/types.ts`)

| Entity | Key fields |
| --- | --- |
| **Product / Variant** (public catalog) | SKU, price (cents), tracked stock, weight, `fulfillmentSource: "in_house" \| "supplier"` (supplier identity stays in `private/`) |
| **Customer** (on the order) | email, name, phone — copied from Stripe's `customer_details` |
| **Order** | `FS-T-YYYYMMDD-XXXXXXXX` (T = test), Stripe session + PaymentIntent ids, `status`, `paymentStatus`, amounts (subtotal/shipping/tax/discount/total in cents), line items, fulfillment groups, shipping address, refunds, `flags` (e.g. `oversold`), history of triggering events |
| **Line item** | variant, SKU, name, quantity, unit price, amount charged, fulfillment source |
| **Fulfillment group** | one per source (our stock / supplier): status, carrier, tracking number + URL, shipped/delivered dates, private supplier reference |
| **Refund** | amount, Stripe refund id, reason, date |
| **Stock ledger** (`inventory.ts`) | per variant: which checkouts hold or bought units; available = on-hand − sold − unexpired holds |

States:

- **Payment:** `processing` → `paid` → (`partially_refunded` \| `refunded`); or `processing` → `failed`.
- **Order:** `awaiting_payment` → `open` → `partially_fulfilled` → `fulfilled`; or `canceled`.
- **Fulfillment:** `unfulfilled` \| `awaiting_supplier` → `sent_to_supplier` → `packed` → `shipped` → `delivered`; or `canceled`.

## Flows

**Our inventory**
1. Shopper starts checkout → server validates the cart and **holds** stock for ~31 min (all-or-nothing, compare-and-set, so two shoppers can't get the last unit).
2. Stripe hosted checkout collects the U.S. shipping address and payment.
3. Verified `checkout.session.completed` (paid) → order `open`, holds become **sold**.
4. Owner packs and ships, adds carrier + tracking → fulfillment `shipped` → customer notified (email not built yet).
5. Unpaid session expires or shopper cancels → holds released automatically.

**Supplier-shipped (dropship)**
1–3. Same as above; the order records `fulfillmentSource: supplier` per line.
4. Fulfillment group starts as `awaiting_supplier`. Owner checks supplier availability, then places the order with the approved partner **by hand** (no automatic supplier purchasing).
5. Owner enters the partner's tracking → `shipped`. Mixed carts get one fulfillment group (and tracking) per source.

**Edge cases handled in code:** delayed payment methods (`processing` until Stripe confirms), async payment failure (order canceled, stock freed), hold expired before payment and stock ran out (order flagged `oversold` for manual contact/refund instead of shipping), refunds from `charge.refunded` (recorded once; stock **not** auto-returned until returned items are inspected), duplicate and concurrent events.

## Storage

| Option | Cost | Fit |
| --- | --- | --- |
| **Netlify Blobs** (used now for test orders, store `stripe-test-orders`, strong consistency, conditional writes) | Included in Netlify Free; draws on the monthly credits; no published per-GB limit | Good for test mode and very low volume. Encrypted at rest, private to the site. No SQL queries or multi-record transactions. |
| **Managed Postgres** (e.g. Neon or Supabase free tiers) | Free tier to start; paid as volume grows | **Recommended for launch:** real transactions for stock, searchable orders, easy exports for taxes/returns. |
| Stripe Dashboard only | Free | Fine as the payment source of truth, but no stock control or fulfillment tracking. |

**Recommendation:** keep Netlify Blobs for test mode. Before real sales, move orders and stock to a managed Postgres free tier behind the same small store interface (`store.ts`), with Stripe as the payment record. **No database or paid service has been created** — that needs your approval.

Under `npm run dev` the store is in memory (not durable) — fine for local testing only.

## Still to build before launch

Order confirmation and shipping emails (with tracking); an owner-only order screen (needs login); stock sync with TikTok Shop so the same unit can't sell twice across channels; data retention rule (decision B5); export for bookkeeping.

## Ship-by dates, delay notices and disputes (legal audit, 2026-10-27)

- Each package gets a **ship-by date**: our own stock = 2 business days after payment (Eastern Time, U.S. federal holidays
  skipped). Supplier packages start without one — set it on the order page from the product's stated processing time.
- The orders list and each order show what needs you, most urgent first: open card disputes, **ship-by passed**,
  territory addresses, oversold items, ships today, missing ship-by date.
- **Can't make the date?** Before it passes, use "Send a delay notice" on the package. The email gives the new date (or
  says you can't give one), offers a free cancel-and-refund by replying, and says what happens if the customer doesn't
  reply. A first delay to a date within 30 days of the original ship-by date: silence = agreement. Longer, unknown or a
  second delay: they must say yes — if they don't, cancel and refund the items (within 7 business days at the latest).
- **Disputes:** `charge.dispute.*` webhooks add the dispute, its reason, status and evidence deadline to the order. Respond
  in the Stripe Dashboard with: the order record, tracking and delivery confirmation, the emails sent (confirmation,
  shipping, any delay notice), the policy versions shown at checkout (stored on the order), and your messages with the
  customer.
