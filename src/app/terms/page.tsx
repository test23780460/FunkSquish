import Link from "next/link";
import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Service (draft)",
  description: "Draft terms of service for FunkSquish. Pending owner and legal review.",
  path: "/terms",
  noindex: true,
});

/** Terms of Service — DRAFT until the owner approves it after legal review (see docs/LEGAL-REVIEW.md). */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="October 27, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) apply to your use of <a href={siteConfig.url}>funksquish.com</a>{" "}
        (the &ldquo;Site&rdquo;) and to purchases from it, operated by {siteConfig.legalOperator} (&ldquo;FunkSquish,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using the Site or placing an order, you agree to these Terms. Our{" "}
        <Link href="/privacy">Privacy Policy</Link> separately explains our personal-information practices; it is a notice, not an additional contract you must agree to.
      </p>

      <h2>Pre-launch Site</h2>
      <p>
        FunkSquish hasn&apos;t launched yet. Nothing on the Site is currently offered for sale, and no orders can be placed. The
        sections about orders apply once our shop opens.
      </p>

      <h2>Preview content</h2>
      <p>
        Products shown in our shop preview are illustrated samples. They are not real inventory and are not offers to sell.
        Final products, designs, colors, prices and availability may be different or may never be offered.
      </p>

      <h2>Who can buy</h2>
      <p>
        You must be at least 18, or have a parent or guardian place the order, to buy from us. Our toys are for the ages shown on
        each product&apos;s label and page. <Todo>legal review: minimum purchaser age and parental-consent wording</Todo>
      </p>

      <h2>Orders, payment and pricing (when the shop opens)</h2>
      <ul>
        <li>
          <strong>Payment.</strong> Payments are processed by Stripe on Stripe&apos;s secure checkout page. At launch we accept
          major credit and debit cards. Your payment method is charged when checkout is completed successfully; submitting a cart alone does not charge you.
        </li>
        <li>
          <strong>Order confirmation and acceptance.</strong> After you pay, we email you an order confirmation. That email
          confirms we received your order and payment; we accept the order when we ship it. We may cancel an order — for
          example, if an item turns out to be out of stock, the address is outside the area we ship to, or the order looks
          fraudulent. If we do, we&apos;ll tell you and promptly refund amounts paid for the canceled items and any associated shipping charges. If an entire order is canceled, we&apos;ll refund the entire order, including shipping and taxes.
        </li>
        <li>
          <strong>Prices, shipping and tax.</strong> Prices are in U.S. dollars. Shipping options and their prices, and any sales
          tax, are shown at checkout before you pay. <Decision>sales-tax collection setup (e.g. Stripe Tax registrations)</Decision>
        </li>
        <li>
          <strong>Pricing errors.</strong> We won&apos;t charge a higher price without your express authorization. If we discover a genuine price or listing error before shipment, we may offer the item at the corrected price or cancel and promptly refund the affected order. These terms do not permit misleading prices or post-purchase price changes.
        </li>
        <li>
          <strong>Quantity limits.</strong> We may publish reasonable quantity limits before checkout, including for limited drops. A limit will not change an already accepted and paid order without notice and an appropriate refund.
        </li>
        <li>
          <strong>Product information.</strong> We try to describe products and colors accurately. Minor variations in color or appearance may occur, but product listings must accurately state the item, material, size, age guidance and material safety warnings. We won&apos;t substitute a materially different product without your agreement.
        </li>
        <li>
          <strong>Shipping, returns and refunds</strong> are covered by our <Link href="/shipping">Shipping Policy</Link> and{" "}
          <Link href="/returns">Returns &amp; Refunds Policy</Link>, which are part of these Terms.
        </li>
        <li>
          <strong>Marketplace orders.</strong> Purchases through TikTok Shop or another marketplace are also subject to that
          marketplace&apos;s terms, and some order questions are handled there.
        </li>
      </ul>

      <h2>Product safety</h2>
      <p>
        Please follow the age grading, warnings and care instructions on each product&apos;s label and page. Never heat or
        microwave squishy toys, and stop using any squishy that is torn, leaking or sticky. See{" "}
        <Link href="/product-care">Product care &amp; safety</Link>.
      </p>

      <h2>Our content</h2>
      <p>
        The FunkSquish name, logo, mascot, illustrations and other Site content belong to us or our licensors. Please don&apos;t copy
        or reuse them without permission.
      </p>

      <h2>Using the Site</h2>
      <ul>
        <li>Use the Site only for lawful purposes.</li>
        <li>Don&apos;t try to disrupt, hack or overload the Site, or use it to send spam.</li>
        <li>Don&apos;t pretend to be FunkSquish or claim to sell our products on our behalf.</li>
        <li>
          Applying through our partner page doesn&apos;t create a partnership, wholesale account or agreement. Nothing is agreed
          until both sides sign a written agreement.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        The Site links to and uses services like TikTok and Stripe. Their own terms and policies apply to them, and we aren&apos;t
        responsible for their content or practices.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The Site is provided &ldquo;as is.&rdquo; To the extent allowed by law, FunkSquish isn&apos;t liable for indirect, incidental
        or consequential damages from using the Site. This doesn&apos;t limit our responsibility for the products we sell, any
        warranty that applies to them, or any rights you have under consumer protection or product-safety laws that can&apos;t be
        waived. <Todo>legal review of disclaimers, warranties and limitation of liability</Todo>
      </p>

      <h2>Disputes and governing law</h2>
      <p>
        If something goes wrong, please email us first at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> — most
        problems can be fixed quickly. These Terms are governed by the laws of the Commonwealth of Kentucky, without regard to
        its conflict-of-law rules. This doesn&apos;t take away any protections you have under the consumer laws of the state where
        you live, and nothing here stops you from bringing a claim in small-claims court or disputing a charge with your card
        issuer. <Todo>legal review: venue, and whether to add or avoid an arbitration clause</Todo>
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. The date at the top shows when they last changed. Changes don&apos;t affect orders you placed
        before the change.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
