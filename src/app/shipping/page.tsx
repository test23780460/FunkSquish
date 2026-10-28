import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { POLICIES } from "@/content/policies";

export const metadata = pageMetadata({
  title: "Shipping Policy",
  description:
    "FunkSquish shipping policy: U.S. shipping (50 states, D.C. + APO/FPO/DPO), shipping calculated for your cart and shown before you pay, our stock ships within 2 business days, tracking on every package.",
  path: "/shipping",
});

/**
 * Shipping policy — terms approved by the owner on Oct 24, 2026
 * (docs/OWNER-DECISIONS.md S1–S6). Written to fit the FTC Mail, Internet,
 * or Telephone Order Merchandise Rule (16 CFR Part 435). The Oct 27, 2026
 * clarifications and the owner's Phase 2 decisions (mixed-origin orders,
 * per-package shipping — docs/MIXED-ORDER-SHIPPING.md) need the owner's
 * sign-off on this exact wording before merge (docs/POLICY-COMPARISON.md).
 */
export default function ShippingPage() {
  return (
    <LegalPage title="Shipping Policy" lastUpdated={POLICIES.shipping.lastUpdated} draft={false}>
      <p>
        FunkSquish hasn&apos;t opened yet, so no orders are being shipped. This policy applies to orders placed on funksquish.com once
        the shop opens.
      </p>

      <h2>Where we ship</h2>
      <p>
        We ship within the <strong>United States only</strong>: all 50 states (including Alaska and Hawaii), Washington, D.C., and
        military APO/FPO/DPO addresses. We don&apos;t ship to U.S. territories (such as Puerto Rico, Guam, the U.S. Virgin Islands,
        American Samoa or the Northern Mariana Islands) or to the Marshall Islands, Micronesia or Palau yet. Our checkout may still
        let you choose one of those addresses; if it does, we&apos;ll cancel that order and promptly refund it in full.
      </p>

      <h2>Shipping costs</h2>
      <p>
        Shipping is paid by the buyer and is calculated for your cart before you pay. Items ship either from our own stock or
        directly from one of our supplier partners. Items that ship from the same place are packed together in one package with one
        shipping charge; items from a different place ship in a separate package with its own charge. Each package&apos;s charge is
        based on our confirmed shipping rate for the place it ships from and the number or weight of the items in it. So an order
        with items from more than one place can cost more to ship than an order from one place.
      </p>
      <p>
        Your cart shows each package&apos;s shipping charge, and our secure checkout page shows the combined shipping charge, any sales
        tax, and your order total <strong>before you pay</strong>. That combined charge covers every package in your order — we never
        add shipping charges after you pay. If we can&apos;t calculate shipping for an item from confirmed rates, we don&apos;t sell it until
        we can: checkout tells you, and the rest of your cart can still be ordered. Sales tax, where it applies, is calculated on your
        items and, in states that tax it, on shipping. We don&apos;t offer free shipping at this time.
      </p>

      <h2>Processing time</h2>
      <p>
        We pack and ship items from our own stock within <strong>2 business days</strong> of receiving the order. That means by the
        end of the second business day after the day we receive your paid order. Business days are Monday–Friday, excluding U.S.
        federal holidays, and days are counted in U.S. Eastern Time. For example, an order paid on a Saturday ships by the end of
        Tuesday.
      </p>
      <p>
        If a product takes longer to ship — for example, an item shipped directly by one of our suppliers, or a pre-order — its own
        processing time is shown on the product page before you buy, and that time applies instead. We don&apos;t offer an item for sale
        until we can support its stated shipping time. A busy launch or LIVE sale by itself doesn&apos;t extend the ship-by date for an
        order.
      </p>
      <p>
        Each package has its own ship-by date, counted from when we receive your paid order: 2 business days for our own stock, or the
        time shown on the product page for supplier-shipped items. Your cart and our checkout page show how many packages your order
        ships in and how long each takes, and your order confirmation lists each package&apos;s ship-by date.
      </p>

      <h2>Delivery times</h2>
      <p>
        Delivery time depends on the carrier and your location. Any delivery estimate shown at checkout is an estimate, not a
        guarantee. We don&apos;t guarantee delivery dates.
      </p>

      <h2>Tracking</h2>
      <p>
        Every package includes tracking. We&apos;ll email you each package&apos;s tracking number when it ships, so an order in two
        packages gets two shipping emails (TikTok Shop orders show tracking in the TikTok app).
      </p>

      <h2>If your order is delayed</h2>
      <p>
        If we can&apos;t ship a package on time, we&apos;ll email you <strong>before its ship-by date</strong> with a new shipping date (or tell
        you we don&apos;t know it yet) and give you a free, easy way to cancel for a full refund of the unshipped items. If your order
        is in more than one package, a delay to one package doesn&apos;t change the others, and canceling the delayed package refunds its
        items, its shipping charge and any tax on them.
      </p>
      <ul>
        <li>
          If the new date is no more than 30 days after the original ship-by date and you don&apos;t reply, we&apos;ll treat that as agreeing
          to wait until that date.
        </li>
        <li>
          If the delay would be longer than that, or we can&apos;t give a date, we&apos;ll ship only within 30 days after the original
          ship-by date unless you tell us you&apos;re happy to wait longer. If we can&apos;t, we&apos;ll cancel and refund the unshipped items.
        </li>
        <li>
          If we miss a new date we gave you, we&apos;ll ask you again, and we&apos;ll cancel and refund unless you tell us you want to keep
          waiting.
        </li>
        <li>You can cancel the delayed items any time before they ship.</li>
      </ul>
      <p>
        Instead of asking you to wait, we may simply cancel the delayed items and refund them. Refunds for canceled items go to your
        original payment method promptly — within 7 business days at the latest. We never hold your payment for an order we can&apos;t
        fill.
      </p>

      <h2>Lost, stolen, or damaged packages</h2>
      <ul>
        <li>
          <strong>Arrived damaged:</strong> please email us — ideally within <strong>7 days of delivery</strong> — with your order
          number and, if you can, photos of the item and packaging. See our <Link href="/returns">Returns &amp; Refunds Policy</Link>.
        </li>
        <li>
          <strong>Lost in transit:</strong> if the carrier loses a package or tracking shows it was destroyed before delivery,
          we&apos;ll send a replacement at no cost or refund that package in full (its items, its shipping charge and any tax), your
          choice. You don&apos;t have to file a carrier claim. (Packages returned to us as undeliverable are covered below.)
        </li>
        <li>
          <strong>Tracking says delivered but it isn&apos;t there:</strong> check with neighbors and your mail carrier, then email us
          within <strong>14 days of the delivery date</strong>. We&apos;ll investigate promptly with the carrier and work with you on an
          appropriate replacement or refund. Reporting later doesn&apos;t take away any right you have by law, but it makes a carrier
          investigation harder. A carrier claim is never a condition of any right you have by law.
        </li>
        <li>
          <strong>Tracking hasn&apos;t moved in 10 days:</strong> email us and we&apos;ll contact the carrier.
        </li>
      </ul>

      <h2>Address changes and undeliverable packages</h2>
      <p>
        Please check your address at checkout. If you need to change it, email us right away — we can usually help before the order
        ships. If a package comes back to us as undeliverable because of the address entered at checkout or a missed pickup, we can
        reship it once you pay for new postage, or refund its items (and any tax on them) minus that package&apos;s original shipping
        charge, within 5 business days after it reaches us. If it came back because of our mistake or the carrier&apos;s, we&apos;ll
        reship it at no cost or refund it in full, your choice.
      </p>
      <p>
        Some items shipped by our supplier partners can&apos;t be sent to APO/FPO/DPO addresses. If that applies to anything in your
        cart, our checkout page says so before you pay. If such an order is placed anyway, we&apos;ll refund those items in full,
        including their shipping charge and tax.
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        If you buy through TikTok Shop, TikTok Shop&apos;s shipping, tracking, and order rules apply to that order, and order questions
        are handled through the TikTok app.
      </p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
