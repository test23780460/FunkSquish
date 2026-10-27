import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Shipping Policy",
  description:
    "FunkSquish shipping policy: U.S. shipping (50 states + APO/FPO/DPO), buyer-paid shipping shown at checkout, our stock ships within 2 business days, tracking on every order.",
  path: "/shipping",
});

/**
 * Shipping policy — terms approved by the owner on Oct 24, 2026
 * (docs/OWNER-DECISIONS.md S1–S6). Written to fit the FTC Mail, Internet,
 * or Telephone Order Merchandise Rule.
 */
export default function ShippingPage() {
  return (
    <LegalPage title="Shipping Policy" lastUpdated="October 24, 2026" draft={false}>
      <p>
        FunkSquish hasn&apos;t opened yet, so no orders are being shipped. This policy applies to orders once the shop
        opens.
      </p>

      <h2>Where we ship</h2>
      <p>
        We ship within the <strong>United States only</strong>: all 50 states, including Alaska and Hawaii, and military
        APO/FPO/DPO addresses. We don&apos;t ship to U.S. territories yet. Our checkout may still let you choose a territory
        address (such as Puerto Rico or Guam); if it does, we&apos;ll cancel that order and refund it in full.
      </p>

      <h2>Shipping costs</h2>
      <p>
        Shipping is paid by the buyer. The shipping options and their prices are shown at checkout, and you&apos;ll always see
        the total before you pay. We don&apos;t offer free shipping at this time.
      </p>

      <h2>Processing time</h2>
      <p>
        We pack and ship items from our own stock within <strong>2 business days</strong> of receiving the order
        (Monday–Friday, excluding U.S. federal holidays). If we advertise a longer processing time for a particular product or promotion, we&apos;ll clearly disclose it before checkout. A busy launch by itself does not automatically extend the ship-by date for an accepted order. Supplier-shipped items may have a different ship-by timeframe, which must be disclosed before purchase on the product page and at checkout. We will not offer a supplier-shipped item for sale until we can support its stated shipping timeframe. Mixed orders may arrive in separate packages.
      </p>

      <h2>Delivery times</h2>
      <p>
        Delivery time depends on the carrier and your location. Any delivery estimate shown at checkout is an estimate, not a guarantee, unless we expressly promise a delivery date. We don&apos;t guarantee delivery dates.
      </p>

      <h2>Tracking</h2>
      <p>
        Every shipped order includes tracking. We&apos;ll email you the tracking number when your order ships (TikTok Shop orders
        show tracking in the TikTok app).
      </p>

      <h2>If your order is delayed</h2>
      <p>
        If we cannot ship by the promised date, we&apos;ll contact you promptly and no later than that date. When required by law, we&apos;ll seek your consent to a revised ship date or cancel and promptly refund the affected unshipped items. We will not treat silence as permission to delay when the law requires express consent. If an order cannot be fulfilled, we&apos;ll cancel and refund it rather than hold the payment indefinitely. Refunds for canceled orders are issued
        promptly to your original payment method.
      </p>

      <h2>Lost, stolen, or damaged packages</h2>
      <ul>
        <li>
          <strong>Arrived damaged:</strong> email us within <strong>7 days of delivery</strong> with your order number and
          photos of the item and packaging. See our <Link href="/returns">Returns &amp; Refunds Policy</Link>.
        </li>
        <li>
          <strong>Tracking says delivered but it isn&apos;t there:</strong> check with neighbors and your mail carrier, then email
          us within <strong>14 days of the delivery date</strong>. We&apos;ll investigate promptly with the carrier and work with you on an appropriate replacement or refund; a carrier claim is not a condition of exercising any rights provided by law.
        </li>
        <li>
          <strong>Tracking hasn&apos;t moved in 10 days:</strong> email us and we&apos;ll contact the carrier.
        </li>
      </ul>

      <h2>Address changes and undeliverable packages</h2>
      <p>
        Please check your address at checkout. If you need to change it, email us right away — we can usually help before the
        order ships. If a package is returned to us as undeliverable, we can reship it once you pay for new postage, or
        refund the items minus the original shipping cost.
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        If you buy through TikTok Shop, TikTok Shop&apos;s shipping, tracking, and order rules also apply, and some order
        questions are handled through the TikTok app.
      </p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
