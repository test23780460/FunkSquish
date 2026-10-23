import Link from "next/link";
import { LegalPage, Todo } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Service (draft)",
  description: "Draft terms of service for FunkSquish. Pending owner review.",
  path: "/terms",
  noindex: true,
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="October 23, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) apply to your use of <a href={siteConfig.url}>funksquish.com</a>{" "}
        (the &ldquo;Site&rdquo;), operated by <Todo>legal business name</Todo> (&ldquo;FunkSquish,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using the Site, you agree to these Terms.
      </p>

      <h2>Pre-launch Site</h2>
      <p>
        FunkSquish has not launched yet. Nothing on the Site is currently offered for sale, and no orders can be placed.
      </p>

      <h2>Preview content</h2>
      <p>
        Products shown in our shop preview are illustrated samples. They are not real inventory and are not offers to
        sell. Final products, designs, colors, prices, and availability may be different or may never be offered.
      </p>

      <h2>Our content</h2>
      <p>
        The FunkSquish name, logo, mascot, illustrations, and other Site content belong to us or our licensors. Please
        don&apos;t copy or reuse them without permission.
      </p>

      <h2>Using the Site</h2>
      <ul>
        <li>Use the Site only for lawful purposes.</li>
        <li>Don&apos;t try to disrupt, hack, or overload the Site.</li>
        <li>Don&apos;t pretend to be FunkSquish or claim to sell our products on our behalf.</li>
      </ul>

      <h2>Third-party links</h2>
      <p>The Site links to services like TikTok. We aren&apos;t responsible for their content or practices.</p>

      <h2>Orders and pricing (when the shop opens)</h2>
      <ul>
        <li>
          <strong>Order acceptance.</strong> Your order is an offer to buy. We accept it when we ship it or send a shipping
          confirmation. We may decline or cancel an order — for example, if an item is out of stock or the order looks
          fraudulent — and if we do, we&apos;ll refund any payment in full.
        </li>
        <li>
          <strong>Prices and errors.</strong> Prices are in U.S. dollars and shown at checkout with shipping and any tax before
          you pay. If a product is listed at the wrong price, we&apos;ll contact you before shipping and let you cancel for a full
          refund.
        </li>
        <li>
          <strong>Product information.</strong> We try to describe products and colors accurately. Real items may look slightly
          different from photos or illustrations.
        </li>
        <li>
          <strong>Shipping, returns, and refunds</strong> are covered by our <Link href="/shipping">Shipping Policy</Link> and{" "}
          <Link href="/returns">Returns &amp; Refunds Policy</Link>.
        </li>
        <li>
          <strong>Marketplace orders.</strong> Purchases through TikTok Shop or another marketplace are also subject to that
          marketplace&apos;s terms.
        </li>
      </ul>

      <h2>Product safety</h2>
      <p>
        Please follow the age grading, warnings, and care instructions on each product&apos;s label and product page. Never
        heat or microwave squishy toys. See <Link href="/product-care">Product care &amp; safety</Link>.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        The Site is provided &ldquo;as is.&rdquo; To the extent allowed by law, FunkSquish isn&apos;t liable for indirect or
        consequential damages from using the Site. Nothing in these Terms limits rights you have under consumer protection law
        that can&apos;t be waived. <Todo>legal review of disclaimers and limitation of liability</Todo>
      </p>

      <h2>Governing law</h2>
      <p>
        <Todo>State / jurisdiction to be confirmed by owner.</Todo>
      </p>

      <h2>Changes</h2>
      <p>We may update these Terms. The date at the top shows when they last changed.</p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
