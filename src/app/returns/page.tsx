import Link from "next/link";
import { LegalPage, Decision } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Returns & Refunds Policy (draft)",
  description: "Draft returns, exchanges and refunds policy for FunkSquish. To be finalized before the shop opens.",
  path: "/returns",
  noindex: true,
});

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & Refunds Policy" lastUpdated="October 23, 2026">
      <p>
        FunkSquish has not opened yet, so there are no orders to return. This draft outlines the topics our returns policy
        will cover. None of it applies until the draft label is removed.
      </p>

      <h2>Return window</h2>
      <p>
        <Decision>how many days after delivery a return can be requested, or whether all sales are final except damaged/incorrect items</Decision>
      </p>

      <h2>Items that can be returned</h2>
      <ul>
        <li>
          Condition: <Decision>e.g. unused, unsqueezed and in original packaging — decide given hygiene concerns with squishy toys</Decision>
        </li>
        <li>
          Non-returnable items: <Decision>e.g. opened mystery/blind items, sale items, gift cards — decide</Decision>
        </li>
      </ul>

      <h2>Damaged, defective or wrong items</h2>
      <p>
        If something arrives damaged, defective, leaking or isn&apos;t what you ordered, email{" "}
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your order number and a photo.{" "}
        <Decision>time limit to report, and whether we replace, refund, or both</Decision>
      </p>
      <p>For your safety, please stop using any squishy that is torn, leaking, sticky or has a strong chemical smell.</p>

      <h2>How to start a return</h2>
      <p>
        Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> before sending anything back.{" "}
        <Decision>return address process (never publish a home address), and who pays return shipping</Decision>
      </p>

      <h2>Refunds</h2>
      <p>
        Approved refunds go back to the original payment method through our payment provider.{" "}
        <Decision>when refunds are issued (e.g. after the return is received and inspected), and whether original shipping is refunded</Decision>
        {" "}Your bank or card issuer may take additional time to show the refund.
      </p>

      <h2>Exchanges</h2>
      <p>
        <Decision>whether exchanges (e.g. different color) are offered, or return-and-reorder only</Decision>
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        Purchases made through TikTok Shop are also covered by TikTok Shop&apos;s own return and refund process.{" "}
        <Decision>confirm how our policy and TikTok Shop&apos;s policy fit together</Decision>
      </p>

      <h2>Your rights</h2>
      <p>
        Nothing in this policy limits any rights you have under applicable consumer protection law.{" "}
        <Decision>legal review of this policy before launch</Decision>
      </p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
