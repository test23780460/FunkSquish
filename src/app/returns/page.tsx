import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Returns & Refunds Policy",
  description:
    "FunkSquish returns and refunds: 30-day returns of unopened items, free replacement or full refund for damaged or wrong items, refunds within 5 business days.",
  path: "/returns",
});

/**
 * Returns policy — terms approved by the owner on Oct 24, 2026
 * (docs/OWNER-DECISIONS.md R1–R9). The 30-day window matches the standard
 * TikTok Shop U.S. window so both channels feel the same.
 */
export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & Refunds Policy" lastUpdated="October 24, 2026" draft={false}>
      <p>
        FunkSquish hasn&apos;t opened yet. This policy applies to orders once the shop opens. We want every squishy to arrive
        happy — and if something goes wrong, we&apos;ll make it right.
      </p>

      <h2>Damaged, defective, or wrong items</h2>
      <p>
        If your order arrives damaged, leaking, defective, or isn&apos;t what you ordered, email us within{" "}
        <strong>7 days of delivery</strong> at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your order
        number and a photo of the item and packaging. We&apos;ll send a <strong>free replacement or a full refund</strong>{" "}
        including the original shipping cost — your choice. We may not need the item back; if we do, we&apos;ll pay for
        return shipping.
      </p>
      <p>For safety, please stop using any squishy that is torn, leaking, sticky, or has a strong chemical smell.</p>

      <h2>Changed your mind?</h2>
      <p>
        You can return <strong>unopened, unused items in their original packaging</strong> within{" "}
        <strong>30 days of delivery</strong> for a refund of the item price. Because squishies are squeezed and handled, we
        can&apos;t accept change-of-mind returns of opened or used items.
      </p>
      <ul>
        <li>Return shipping for change-of-mind returns is paid by the buyer. There are no restocking fees.</li>
        <li>Original shipping charges aren&apos;t refunded for change-of-mind returns.</li>
        <li>
          <strong>Final sale:</strong> opened mystery and blind-bag items can&apos;t be returned for change of mind. Product
          pages will say when an item is final sale. Damaged or wrong items are always covered.
        </li>
      </ul>

      <h2>How to start a return</h2>
      <ol>
        <li>
          Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your order number and what you&apos;d like
          to return. Please don&apos;t send items back before we reply.
        </li>
        <li>We&apos;ll reply with return instructions and the return address.</li>
        <li>Ship the item with tracking, and keep your tracking number until your refund is complete.</li>
      </ol>

      <h2>Refunds</h2>
      <p>
        Approved refunds go back to your original payment method through our payment provider, within{" "}
        <strong>5 business days</strong> after we receive and check the return (or after we approve a damaged-item claim).
        Your bank or card issuer may take a few more days to show it.
      </p>

      <h2>Exchanges</h2>
      <p>
        We don&apos;t do direct exchanges. To get a different color or style, return the unopened item for a refund and place
        a new order.
      </p>

      <h2>Canceling an order</h2>
      <p>
        Email us as soon as possible. If your order hasn&apos;t shipped yet, we&apos;ll cancel it and issue a full refund. Once it has
        shipped, the return rules above apply.
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        Orders placed through TikTok Shop are returned and refunded through TikTok Shop&apos;s process in the TikTok app, and
        TikTok Shop&apos;s rules apply in addition to this policy.
      </p>

      <h2>Your rights</h2>
      <p>Nothing in this policy limits any rights you have under applicable consumer protection laws.</p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
