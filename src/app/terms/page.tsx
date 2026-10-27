import Link from "next/link";
import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { POLICIES } from "@/content/policies";

export const metadata = pageMetadata({
  title: "Terms of Service (draft)",
  description: "Draft terms of service for FunkSquish. Pending owner and legal review.",
  path: "/terms",
  noindex: true,
});

const mail = `mailto:${siteConfig.email}`;

/** Terms of Service — DRAFT until the owner approves it after legal review (see docs/LEGAL-OPEN-QUESTIONS.md). */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={POLICIES.terms.lastUpdated}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) apply to your use of <a href={siteConfig.url}>funksquish.com</a> (the
        &ldquo;Site&rdquo;) and to purchases from it, operated by {siteConfig.legalOperator} (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). By using the Site or placing an order, you agree to these Terms. Our{" "}
        <Link href="/shipping">Shipping Policy</Link> and <Link href="/returns">Returns &amp; Refunds Policy</Link> are part of these
        Terms. Our <Link href="/privacy">Privacy Policy</Link> separately explains our personal-information practices; it is a notice,
        not an additional contract you must agree to.
      </p>

      <h2>Pre-launch Site</h2>
      <p>
        FunkSquish hasn&apos;t launched yet. Nothing on the Site is currently offered for sale, and no orders can be placed. The sections
        about orders apply once our shop opens.
      </p>

      <h2>Preview content</h2>
      <p>
        Products shown in our shop preview are illustrated samples. They are not real inventory and are not offers to sell. Final
        products, designs, colors, prices and availability may be different or may never be offered.
      </p>

      <h2>Who can buy</h2>
      <p>
        You must be at least 18, or have a parent or guardian place the order, to buy from us. We currently sell and ship only to
        addresses in the area described in our <Link href="/shipping">Shipping Policy</Link>. Our toys are for the ages shown on each
        product&apos;s label and page. <Todo>legal review: minimum purchaser age and parental-consent wording</Todo>
      </p>

      <h2>Orders and payment (when the shop opens)</h2>
      <ul>
        <li>
          <strong>Payment.</strong> Payments are processed by Stripe on Stripe&apos;s secure checkout page. At launch we accept major
          credit and debit cards. Your payment method is charged when you complete checkout; adding items to a cart does not charge
          you. <Decision>payment methods offered at launch (cards only, and whether Stripe Link is turned off)</Decision>
        </li>
        <li>
          <strong>Order confirmation.</strong> After you pay, we email you an order confirmation. It confirms that we received your
          order and payment. It isn&apos;t a promise that every item will ship — if we can&apos;t fill all or part of an order, the next
          point applies.
        </li>
        <li>
          <strong>If we have to cancel.</strong> We may cancel all or part of an order — for example, if an item turns out to be out of
          stock or was listed in error, the address is outside the area we ship to, the order exceeds a published limit, or we
          reasonably believe the order is fraudulent or unauthorized. If we do, we&apos;ll tell you and promptly refund what you paid for
          the canceled items and any shipping charge that no longer applies. If we cancel an entire order, we refund the entire order,
          including shipping and tax. Canceling never changes the shipping timeframes in our Shipping Policy for the rest of your order.
        </li>
        <li>
          <strong>Canceling yourself.</strong> You can cancel an order that hasn&apos;t shipped for a full refund — see our{" "}
          <Link href="/returns">Returns &amp; Refunds Policy</Link>.
        </li>
        <li>
          <strong>Prices, shipping and tax.</strong> Prices are in U.S. dollars. Shipping options and their prices, and any sales tax,
          are shown at checkout before you pay. We won&apos;t add charges after checkout — including if your order arrives in more than
          one package. <Decision>sales-tax collection setup (e.g. Stripe Tax registrations)</Decision>
        </li>
        <li>
          <strong>Pricing and listing errors.</strong> We won&apos;t charge you more than the price you agreed to at checkout without your
          express permission. If we find a genuine price or listing error before an item ships, we&apos;ll tell you and let you choose
          between buying it at the corrected price or canceling for a full refund of that item. If you don&apos;t choose, we&apos;ll cancel
          and refund it. Once an item has shipped, we won&apos;t ask you to pay more for it.
        </li>
        <li>
          <strong>Quantity limits.</strong> Checkout limits how many of each item one order can contain (the limit is shown in your
          cart if you go over it). For limited drops, any per-customer limit will be stated on the product page before the drop. If
          orders go over a stated per-customer limit — including across several orders — we may cancel the extra units and refund
          them in full, and we&apos;ll tell you. A limit never lets us keep payment for units we don&apos;t ship.
        </li>
        <li>
          <strong>Availability and substitutions.</strong> We won&apos;t send a different product, color or size instead of what you
          ordered without your agreement. If an item becomes unavailable after you pay, we&apos;ll refund it (and offer a replacement
          only if you want one).
        </li>
        <li>
          <strong>Product information.</strong> We describe our products, sizes and materials as accurately as we can, and each listing
          shows the age grading and warnings exactly as they appear on the product&apos;s label. Colors can look slightly different on
          different screens. If an item you receive is materially different from its listing, it&apos;s covered as a wrong item under our{" "}
          <Link href="/returns">Returns &amp; Refunds Policy</Link>.
        </li>
        <li>
          <strong>Which policy version applies.</strong> Your order is governed by the versions of these Terms and our Shipping and
          Returns policies in effect when you placed it. We keep earlier versions and will send you the one that applied on request.
        </li>
        <li>
          <strong>Promotions.</strong> Any discount code, sale or giveaway will have its own written rules shown with it, including
          dates and limits. No purchase is ever necessary to enter a FunkSquish giveaway. We don&apos;t run giveaways that ask you to pay
          for shipping. <Todo>attorney: giveaway official-rules template before any giveaway</Todo>
        </li>
        <li>
          <strong>Marketplace orders.</strong> Purchases through TikTok Shop or another marketplace are made under that
          marketplace&apos;s terms, and returns, refunds and disputes for them go through the marketplace. Our own Shipping and Returns
          policies apply to orders placed on this Site.
        </li>
      </ul>

      <h2>Payment problems, disputes and fraud</h2>
      <ul>
        <li>
          If you think a charge is wrong, please email us — we can usually fix it faster than a bank dispute. That&apos;s a request,
          not a requirement: you can always dispute a charge with your card issuer.
        </li>
        <li>
          If you dispute a charge, we may give Stripe and your card issuer our records of the order, delivery and our messages with
          you. If we&apos;ve already refunded the charge, we&apos;ll tell them.
        </li>
        <li>
          We may refuse or cancel orders, and decline future orders, where we reasonably believe there&apos;s fraud, use of a payment
          card without permission, or abuse of our policies (for example, returning a different item than the one we sent).
        </li>
      </ul>

      <h2>Product safety</h2>
      <p>
        Please follow the age grading, warnings and care instructions on each product&apos;s label and page. Never heat or microwave
        squishy toys, and stop using any squishy that is torn, leaking or sticky. See{" "}
        <Link href="/product-care">Product care &amp; safety</Link>. If we learn of a safety issue or recall affecting something you
        bought from us, we&apos;ll tell you using the contact details on your order.
      </p>

      <h2>Our content</h2>
      <p>
        The FunkSquish name, logo, mascot, illustrations and other Site content belong to us or our licensors. Please don&apos;t copy or
        reuse them without permission.
      </p>

      <h2>Using the Site</h2>
      <ul>
        <li>Use the Site only for lawful purposes.</li>
        <li>Don&apos;t try to disrupt, hack or overload the Site, or use it to send spam.</li>
        <li>Don&apos;t pretend to be FunkSquish, or claim to be our supplier, partner, reseller or affiliate unless we&apos;ve agreed to it in writing.</li>
        <li>
          Applying through our partner page doesn&apos;t create a partnership, wholesale account, reseller authorization or any other
          agreement. Nothing is agreed until both sides sign a written agreement.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        The Site links to and uses services like TikTok and Stripe. Their own terms and policies apply to them, and we aren&apos;t
        responsible for their content or practices.
      </p>

      <h2>Warranties, disclaimers and limitation of liability</h2>
      <p>
        The Site itself (its pages, games and tools, such as the Squish Lab, quiz and Squish Box builder) is provided &ldquo;as is.&rdquo;
        To the extent allowed by law, FunkSquish isn&apos;t liable for indirect, incidental or consequential damages from using the Site.
      </p>
      <p>
        None of this limits our responsibility for the products we sell, any warranty that applies to them by law (including implied
        warranties), our liability for injury caused by our negligence, or any rights you have under consumer-protection or
        product-safety laws that can&apos;t be waived. <Todo>legal review of disclaimers, warranties and limitation of liability</Todo>
      </p>

      <h2>Disputes and governing law</h2>
      <p>
        If something goes wrong, please email us first at <a href={mail}>{siteConfig.email}</a> — most problems can be fixed quickly.
        These Terms are governed by the laws of the Commonwealth of Kentucky, without regard to its conflict-of-law rules. This
        doesn&apos;t take away any protections you have under the consumer laws of the state where you live, and nothing here stops you
        from bringing a claim in small-claims court or disputing a charge with your card issuer. There is no arbitration agreement and
        no class-action waiver in these Terms. <Todo>legal review: venue, and whether to add or avoid an arbitration clause</Todo>
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms. The date at the top shows when they last changed. Changes apply only to orders placed after the
        change takes effect — never to orders you&apos;ve already placed.
      </p>

      <h2>General</h2>
      <ul>
        <li>If any part of these Terms can&apos;t be enforced, the rest still applies.</li>
        <li>If we don&apos;t enforce a part of these Terms right away, we haven&apos;t given up the right to enforce it later.</li>
        <li>These Terms, together with the Shipping and Returns policies, are the whole agreement between you and us about using the Site and buying from it.</li>
        <li>If the FunkSquish business is sold or transferred, we may transfer these Terms to the new owner, and your existing orders stay protected.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={mail}>{siteConfig.email}</a>, or write to {siteConfig.mailingAddress.join(", ")}.
      </p>
    </LegalPage>
  );
}
