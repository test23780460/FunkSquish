import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { POLICIES } from "@/content/policies";

export const metadata = pageMetadata({
  title: "Shipping Policy",
  description:
    "FunkSquish shipping policy: U.S. shipping (50 states, D.C. + APO/FPO/DPO), buyer-paid shipping shown at checkout, our stock ships within 2 business days, tracking on every order.",
  path: "/shipping",
});

/**
 * Shipping policy — terms approved by the owner on Oct 24, 2026
 * (docs/OWNER-DECISIONS.md S1–S6). Written to fit the FTC Mail, Internet,
 * or Telephone Order Merchandise Rule (16 CFR Part 435). The Oct 27, 2026
 * clarifications need the owner's renewed approval before merge
 * (docs/POLICY-COMPARISON.md).
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
        Shipping is paid by the buyer. The shipping options and their prices are shown at checkout, and you&apos;ll always see the total
        before you pay. The shipping charge you pay at checkout covers your whole order — we never charge extra shipping later, even
        if your order arrives in more than one package. We don&apos;t offer free shipping at this time.
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
        order. Orders with items from different places may arrive in separate packages, each with its own tracking.
      </p>

      <h2>Delivery times</h2>
      <p>
        Delivery time depends on the carrier and your location. Any delivery estimate shown at checkout is an estimate, not a
        guarantee. We don&apos;t guarantee delivery dates.
      </p>

      <h2>Tracking</h2>
      <p>
        Every shipped order includes tracking. We&apos;ll email you the tracking number when your order ships (TikTok Shop orders show
        tracking in the TikTok app).
      </p>

      <h2>If your order is delayed</h2>
      <p>
        If we can&apos;t ship on time, we&apos;ll email you <strong>before the ship-by date</strong> with a new shipping date (or tell you we
        don&apos;t know it yet) and give you a free, easy way to cancel for a full refund of the unshipped items.
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
          <strong>Lost in transit:</strong> if the carrier loses the package or tracking shows it was destroyed before delivery,
          we&apos;ll send a replacement or a full refund, your choice. You don&apos;t have to file a carrier claim. (Packages returned to
          us as undeliverable are covered below.)
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
        reship it once you pay for new postage, or refund the items minus the original shipping cost, within 5 business days after
        it reaches us. If it came back because of our mistake or the carrier&apos;s, we&apos;ll reship it at no cost or refund it in full,
        your choice.
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
