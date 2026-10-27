import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { POLICIES } from "@/content/policies";

export const metadata = pageMetadata({
  title: "Returns & Refunds Policy",
  description:
    "FunkSquish returns and refunds: 30-day returns of unopened items, free replacement or full refund for damaged or wrong items, refunds within 5 business days.",
  path: "/returns",
});

const mail = `mailto:${siteConfig.email}`;

/**
 * Returns policy — terms approved by the owner on Oct 24, 2026
 * (docs/OWNER-DECISIONS.md R1–R9). The 30-day window matches the standard
 * TikTok Shop U.S. window so both channels feel the same. The Oct 27, 2026
 * clarifications need the owner's renewed approval before merge
 * (docs/POLICY-COMPARISON.md).
 */
export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & Refunds Policy" lastUpdated={POLICIES.returns.lastUpdated} draft={false}>
      <p>
        FunkSquish hasn&apos;t opened yet. This policy applies to orders placed on funksquish.com once the shop opens. We want every
        squishy to arrive happy — and if something goes wrong, we&apos;ll make it right.
      </p>

      <h2>Damaged, defective, or wrong items</h2>
      <p>
        If your order arrives damaged, leaking, defective, or isn&apos;t what you ordered (including an item that&apos;s materially
        different from its listing), please email us at <a href={mail}>{siteConfig.email}</a> — ideally within{" "}
        <strong>7 days of delivery</strong> — with your order number and, if you can, a photo of the item and packaging. We&apos;ll
        offer a <strong>free replacement or a full refund</strong> including the original shipping cost — your choice. If a
        replacement isn&apos;t available, we&apos;ll refund you in full. We may not need the item back; if we do, we&apos;ll pay for return
        shipping.
      </p>
      <p>
        Reporting later than 7 days, or without a photo, doesn&apos;t take away your rights — it just helps us sort things out faster.
        If a defect shows up later during normal use (for example, a squishy starts leaking), contact us anyway: we&apos;ll review it
        fairly and in line with your legal rights.
      </p>
      <p>
        For safety, please stop using any squishy that is torn, leaking, sticky, or has a strong chemical smell. Keep it, and any
        filling, away from young children and pets — don&apos;t mail back a leaking item unless we send you instructions.
      </p>

      <h2>Changed your mind?</h2>
      <p>
        You can return <strong>unopened, unused items in their original packaging</strong> within <strong>30 days of delivery</strong>{" "}
        for a refund of the item price. &ldquo;Unopened&rdquo; means the retail packaging or seal hasn&apos;t been opened. Because
        squishies are squeezed and handled, we can&apos;t accept change-of-mind returns of opened or used items.
      </p>
      <ul>
        <li>Return shipping for change-of-mind returns is paid by the buyer. There are no restocking fees.</li>
        <li>Original shipping charges aren&apos;t refunded for change-of-mind returns.</li>
        <li>
          <strong>Final sale:</strong> opened mystery and blind-bag items can&apos;t be returned for a change of mind. This applies only
          when the product page says &ldquo;Final sale once opened&rdquo; before you buy. Unopened ones can be returned like any other item.
        </li>
        <li>
          If a change-of-mind return arrives opened, used, damaged after delivery, or isn&apos;t the item we sent, we&apos;ll tell you
          and either send it back to you (you pay postage) or, if you prefer, dispose of it safely. We won&apos;t refund it as a
          change-of-mind return.
        </li>
      </ul>
      <p>
        This voluntary change-of-mind policy is extra to, and doesn&apos;t restrict, the remedies you have by law for faulty, unsafe,
        misdescribed or undelivered goods.
      </p>

      <h2>How to start a return</h2>
      <ol>
        <li>
          Email <a href={mail}>{siteConfig.email}</a> from the address you ordered with, with your order number and what you&apos;d like
          to return. Please don&apos;t send items back before we reply.
        </li>
        <li>We&apos;ll reply with return instructions and the return address.</li>
        <li>Ship the item with tracking, and keep your tracking number until your refund is complete.</li>
      </ol>

      <h2>Refunds</h2>
      <ul>
        <li>
          <strong>Change-of-mind returns:</strong> refunded to your original payment method within{" "}
          <strong>5 business days</strong> after we receive the return.
        </li>
        <li>
          <strong>Damaged, defective or wrong items:</strong> we review claims promptly (usually within 2 business days) and refund
          within <strong>5 business days</strong> after we approve the claim. We don&apos;t wait for the item to come back unless we&apos;ve
          asked for it.
        </li>
        <li>
          <strong>Canceled or unshipped orders:</strong> refunded promptly, and within 7 business days at the latest. We never require
          you to return something that was never delivered.
        </li>
      </ul>
      <p>
        Refunds go through our payment provider. Your bank or card issuer may take a few more days to show it. If a refund can&apos;t
        reach your original payment method (for example, the card was closed), we&apos;ll contact you and refund you another way.
      </p>

      <h2>Exchanges</h2>
      <p>
        We don&apos;t do direct exchanges. To get a different color or style, return the unopened item for a refund and place a new
        order.
      </p>

      <h2>Canceling an order</h2>
      <p>
        Email us as soon as possible. If your order hasn&apos;t shipped yet, we&apos;ll cancel it and issue a full refund, including shipping
        and tax. An item has &ldquo;shipped&rdquo; once it&apos;s been handed to the carrier (or, for a supplier-shipped item, once the
        supplier has sent it). After that, the return rules above apply.
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        Orders placed through TikTok Shop are returned and refunded through TikTok Shop&apos;s process in the TikTok app, under TikTok
        Shop&apos;s rules. Its time limits and who pays return shipping can differ from this policy.
      </p>

      <h2>Your rights</h2>
      <p>Nothing in this policy limits any rights you have under applicable consumer protection laws.</p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={mail}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
