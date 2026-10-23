import Link from "next/link";
import { LegalPage, Decision } from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Shipping Policy (draft)",
  description: "Draft shipping policy for FunkSquish. Shipping details will be confirmed before the shop opens.",
  path: "/shipping",
  noindex: true,
});

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping Policy" lastUpdated="October 23, 2026">
      <p>
        FunkSquish has not opened yet, so no orders are being shipped. This page shows the shipping information we will
        publish before launch. Nothing below is a promise until the draft label is removed.
      </p>

      <h2>Where we ship</h2>
      <p>
        <Decision>shipping destinations, e.g. United States only at launch, and whether APO/FPO, Alaska, Hawaii and U.S. territories are included</Decision>
      </p>

      <h2>Processing time</h2>
      <p>
        Orders are packed and handed to the carrier within <Decision>number of business days</Decision>. Orders placed on
        weekends or holidays are processed the next business day. <Decision>confirm</Decision>
      </p>

      <h2>Shipping methods and costs</h2>
      <p>
        Available shipping options and their exact costs are shown at checkout before you pay. Costs depend on package
        weight and destination.
      </p>
      <ul>
        <li>
          Carriers and services: <Decision>e.g. USPS Ground Advantage — confirm</Decision>
        </li>
        <li>
          Free shipping: <Decision>whether offered and the order minimum</Decision>
        </li>
        <li>
          Estimated delivery times: <Decision>only quote carrier estimates, never guarantee delivery dates</Decision>
        </li>
      </ul>

      <h2>Order tracking</h2>
      <p>
        <Decision>whether every order includes tracking, and how tracking is sent (checkout provider email, TikTok Shop app)</Decision>
      </p>

      <h2>Lost, late or damaged packages</h2>
      <p>
        If your package arrives damaged, or tracking shows delivered but you can&apos;t find it, email us at{" "}
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your order number.{" "}
        <Decision>what we do next (reship, refund, carrier claim) and any time limit for reporting problems</Decision>
      </p>

      <h2>Address problems</h2>
      <p>
        Please double-check your address at checkout. <Decision>what happens if a package is returned as undeliverable</Decision>
      </p>

      <h2>Orders placed on TikTok Shop</h2>
      <p>
        If you buy through TikTok Shop, TikTok Shop&apos;s shipping and order rules may also apply.{" "}
        <Decision>confirm once the TikTok Shop account and its shipping settings are set up</Decision>
      </p>

      <h2>Questions</h2>
      <p>
        See <Link href="/order-help">Order help</Link> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
