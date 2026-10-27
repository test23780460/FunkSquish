import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { analyticsActive, dropAlertsActive, newsletterActive, partnerApplicationsActive } from "@/lib/integrations/status";
import { RETENTION } from "@/lib/partners/retention";

export const metadata = pageMetadata({
  title: "Privacy Policy (draft)",
  description: "Draft privacy policy for FunkSquish. Pending owner and legal review.",
  path: "/privacy",
  noindex: true,
});

/**
 * Privacy policy — DRAFT until the owner approves it after legal review.
 * Every factual statement here is checked against the code (see
 * docs/LEGAL-REVIEW.md). The "active / not active yet" labels come from the
 * real build configuration (lib/integrations/status), so they can't drift.
 */
const status = {
  newsletter: newsletterActive() ? "active" : "not active yet",
  dropAlerts: dropAlertsActive() ? "active" : "not active yet",
  partners: partnerApplicationsActive() ? "active" : "not active yet",
  analytics: analyticsActive() ? "active" : "not active yet",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 27, 2026">
      <p>
        This Privacy Policy explains how FunkSquish (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
        operated by {siteConfig.legalOperator}, collects, uses and shares information when you visit{" "}
        <a href={siteConfig.url}>funksquish.com</a> (the &ldquo;Site&rdquo;), contact us, or (once our shop opens) buy from us.
        FunkSquish is based in Kentucky, United States. Our providers may process or store information in the United States and other countries, depending on their services and configurations.
      </p>

      <h2>Summary</h2>
      <ul>
        <li>We don&apos;t sell or rent your personal information, and we don&apos;t share it for targeted advertising.</li>
        <li>We don&apos;t use advertising cookies or tracking pixels. Our analytics don&apos;t use cookies.</li>
        <li>The Site has no customer accounts. Checkout isn&apos;t open yet; when it is, card payments are handled by Stripe.</li>
        <li>You can ask us what we hold about you, and to correct or delete it.</li>
      </ul>

      <h2>Information we collect, and why</h2>

      <h3>When you email us</h3>
      <p>
        We receive your email address and whatever you include, and use it to reply and keep a record of the conversation.
        Our email is provided by <strong>Google Workspace</strong>.
      </p>

      <h3>When you visit the Site</h3>
      <p>
        Our website host, <strong>Netlify</strong>, automatically processes technical information such as your IP address,
        browser type and the pages you request, so it can deliver the Site and protect it from abuse. We don&apos;t use this to
        identify you.
      </p>

      <h3>Website analytics ({status.analytics})</h3>
      <p>
        We use <strong>Umami</strong>, a privacy-focused analytics service, to count visits and see which pages are popular and how
        people find us (for example, from TikTok). Umami doesn&apos;t use cookies and doesn&apos;t build a profile of you. It records the
        page visited, the referring website, browser and device type, and country. It also counts a few actions — clicks on our
        TikTok links, starting or finishing the quiz, starting a Squish Box, adding to or sharing a wishlist, using the Squish
        Lab, completed email sign-ups, and which partner category someone applied under — never what you type. We use this
        only in aggregate.
      </p>

      <h3>Launch email list ({status.newsletter})</h3>
      <ul>
        <li>
          You give your email address and tick a box agreeing to receive FunkSquish emails. You&apos;re only added after you click
          the link in our confirmation email (&ldquo;double opt-in&rdquo;).
        </li>
        <li>
          Your address and a record of when you signed up and confirmed are stored by our email provider, <strong>Brevo</strong>.
          The Site itself doesn&apos;t store your address.
        </li>
        <li>We use it only to send FunkSquish news, such as our launch and new drops.</li>
        <li>Every email has an unsubscribe link, and you can email us to be removed. We process opt-outs promptly.</li>
      </ul>

      <h3>Drop &amp; restock alerts ({status.dropAlerts})</h3>
      <p>
        Works like the launch list — consent box, confirmation email, stored by Brevo — on a separate list used only to tell you
        about a new drop or restock. Unsubscribe from any alert email.
      </p>

      <h3>Wishlists, Squish Boxes and quiz results</h3>
      <p>
        These are saved only in your own browser (local storage) and are never sent to us. A shared wishlist or box link
        contains product codes and the box name you chose, if any. Anyone you give the link to may see that information; URLs may also appear in hosting or browser records when visited. Clearing your browser data removes locally saved lists and results, but not links already shared.
      </p>

      <h3>TikTok videos</h3>
      <p>
        Some pages show TikTok clips. They don&apos;t load anything from TikTok until you press play; once you do, TikTok&apos;s
        player loads from TikTok and TikTok&apos;s own privacy policy applies to what it collects. Links to our TikTok profile
        open TikTok directly.
      </p>

      <h3>Partner and supplier applications ({status.partners})</h3>
      <p>
        If a business applies through our <a href="/partners">partner page</a>, we store its answers — such as name, work
        email, business and website details, country, and what it tells us about products, pricing, shipping, safety
        documentation and where we may sell — privately with Netlify, so we can review the application and reply. Only
        FunkSquish&apos;s owner can see them, after signing in. Applications are never approved automatically: a person reviews
        each one, and nothing is agreed until both sides sign a written agreement. Brevo sends us a short notice that an
        application arrived (its reference, business name and country, without contact details). Applicants are never added
        to marketing lists.
      </p>
      <p>
        To prevent spam, we make scrambled codes (keyed hashes) from the applicant&apos;s IP address and email address. The codes
        used for rate limits are deleted automatically after 2 days. One code made from the IP address is also kept with the
        application, so we can spot repeated abuse, and is deleted together with the application. We never store the IP address
        itself.
      </p>
      <p>
        <strong>How long we keep applications.</strong> An automatic daily cleanup deletes declined applications{" "}
        {RETENTION.declinedMonths} months after the last activity on them, and other applications — including future reseller
        or distributor interest — {RETENTION.openMonths} months after the last activity (the application itself, a change in its
        review stage, or a note we add). If we start working together, we keep the application while the relationship is active,
        review it at least once a year, and delete it when it&apos;s no longer needed. We keep something longer only if the law
        requires it, and we record why.
      </p>

      <h3>When you buy from us (not active yet)</h3>
      <Decision>checkout launch date, payment methods and order-record retention period</Decision>
      <p>
        Orders will be paid through <strong>Stripe</strong>&apos;s secure checkout page. You type your card details on Stripe&apos;s
        page, not ours — we never see or store your full card number. Stripe processes your payment and may use the information
        to prevent fraud, under its own privacy policy.
      </p>
      <p>To fulfil and support your order we receive and keep an order record with:</p>
      <ul>
        <li>your name, email address and shipping address (and any phone number you choose to give);</li>
        <li>what you bought, the prices, shipping and tax charged, and any discount;</li>
        <li>payment status and references from Stripe (not your card number), refunds, and shipping and tracking details.</li>
      </ul>
      <p>
        Order records are stored privately with Netlify and are visible only to FunkSquish&apos;s owner after signing in. If an item
        ships directly from one of our suppliers, we share only what they need to deliver it — your name, shipping address and the
        items — with that supplier. We keep order records for <strong>[period to be decided]</strong> for tax, accounting,
        warranty and fraud-prevention purposes, then delete them. <Todo>attorney/accountant: required order-record retention period</Todo>
      </p>
      <p>
        We email you about your order (confirmation, shipping and tracking, and anything that needs your attention). These are
        transactional emails, not marketing, and don&apos;t add you to any list.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To reply to messages, review partner applications and, once the shop opens, process and deliver orders.</li>
        <li>To send launch emails or drop alerts, only if you&apos;ve signed up and confirmed.</li>
        <li>To run, secure, improve and protect the Site and prevent fraud and abuse.</li>
        <li>To meet legal, tax and accounting obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We share personal information only with service providers that run parts of our business for us, or when the law requires it:</p>
      <ul>
        <li><strong>Netlify</strong> — website hosting and private storage of partner applications and (later) orders.</li>
        <li><strong>Google Workspace</strong> — our email.</li>
        <li><strong>Brevo</strong> — notices to us about partner applications and, if you sign up, our email lists.</li>
        <li><strong>Umami</strong> — cookie-free website analytics ({status.analytics}).</li>
        <li><strong>Stripe</strong> — card payments, once checkout opens.</li>
        <li>Shipping carriers and, for supplier-shipped items, the supplier — the details needed to deliver an order.</li>
        <li>TikTok — only if you press play on a TikTok clip or buy through TikTok Shop, under TikTok&apos;s terms.</li>
      </ul>
      <p>We don&apos;t sell or rent personal information, and we don&apos;t share it for cross-context behavioral advertising.</p>

      <h2>Children</h2>
      <p>
        We intend the Site for a general audience, rather than specifically for children under 13. This statement does not determine the Site&apos;s classification under children&apos;s privacy law. We don&apos;t knowingly collect personal
        information from children under 13 — our sign-up, partner and (future) checkout forms are intended for adults. Wishlists, the quiz
        and the Squish Box stay in the browser and aren&apos;t sent to us. If you believe a child has sent us personal information,
        email us and we&apos;ll delete it. <Todo>legal review of children&apos;s privacy approach (COPPA), given that squishies appeal to children</Todo>
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask what personal information we hold about you, and ask us to correct or delete it, by emailing{" "}
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. We&apos;ll take reasonable steps to verify the requester before disclosing or deleting information; access to an email address alone may not be sufficient for sensitive order details. We aim to respond within 30 days, or within a different period required by applicable law, and will explain any permitted extension. We may keep information we&apos;re legally required to keep (such
        as order records needed for taxes) and will tell you if so. Unsubscribe from emails at any time with the link in each
        email. Depending on where you live, you may have additional rights under state law.{" "}
        <Todo>legal review of applicable state privacy laws (including Kentucky&apos;s) and whether any thresholds apply</Todo>
      </p>

      <h2>Keeping information</h2>
      <ul>
        <li>Emails: retained as needed for customer support and legitimate business and legal purposes; the precise schedule is under review.</li>
        <li>Email-list subscribers: until they unsubscribe or ask to be deleted.</li>
        <li>Partner applications: the schedule above, enforced automatically.</li>
        <li>Orders: the period stated above, once decided.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Private application and order records are intended to be accessible only through restricted administrative interfaces, not public pages. We avoid placing customer details in ordinary application logs and public source code; access controls and operational procedures must be checked before live checkout. Payments are handled by Stripe. No method of storing or sending information is perfectly secure, but we
        work to protect it, and we&apos;ll notify you if the law requires it after a breach.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The date at the top shows when it last changed. If we make a material change to how we use
        personal information, we&apos;ll say so on this page before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, or write to us at:
      </p>
      <address className="not-italic">
        {siteConfig.mailingAddress.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </LegalPage>
  );
}
