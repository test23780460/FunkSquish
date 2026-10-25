import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { analyticsActive, dropAlertsActive, newsletterActive, partnerApplicationsActive } from "@/lib/integrations/status";

export const metadata = pageMetadata({
  title: "Privacy Policy (draft)",
  description: "Draft privacy policy for FunkSquish. Pending owner review.",
  path: "/privacy",
  noindex: true,
});

/**
 * Privacy policy — DRAFT until the owner approves it. Sections for Brevo and
 * Umami describe those services exactly as they're configured in this site.
 * The "active / not active yet" labels are computed from the real build
 * configuration (lib/integrations/status), so they can't drift.
 */
const status = {
  newsletter: newsletterActive() ? "active" : "not active yet",
  dropAlerts: dropAlertsActive() ? "active" : "not active yet",
  partners: partnerApplicationsActive() ? "active" : "not active yet",
  analytics: analyticsActive() ? "active" : "not active yet",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 24, 2026">
      <p>
        This Privacy Policy explains how FunkSquish (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
        operated by {siteConfig.legalOperator}, collects and uses information when you visit{" "}
        <a href={siteConfig.url}>funksquish.com</a> (the &ldquo;Site&rdquo;) or contact us. FunkSquish is based in Kentucky, United States.
      </p>

      <h2>Summary</h2>
      <ul>
        <li>We don&apos;t sell your personal information.</li>
        <li>We don&apos;t use advertising cookies or tracking pixels.</li>
        <li>The Site has no accounts and, until the shop opens, no checkout.</li>
        <li>You can ask us to delete your information at any time.</li>
      </ul>

      <h2>Information we collect</h2>
      <h3>When you email us</h3>
      <p>We receive your email address and whatever you include in your message. Our email is provided by Google Workspace.</p>

      <h3>When you visit the Site</h3>
      <p>
        Our website host, <strong>Netlify</strong>, automatically processes technical information such as your IP address,
        browser type, and the pages you request, so it can deliver the Site and protect it from abuse.
      </p>

      <h3>Launch email list ({status.newsletter})</h3>
      <p>If you choose to join our launch email list:</p>
      <ul>
        <li>
          You give your email address and tick a box agreeing to receive FunkSquish emails. You&apos;re only added after you
          click the link in our confirmation email (&ldquo;double opt-in&rdquo;).
        </li>
        <li>
          Your email address, and a record of when you signed up and confirmed, are stored by our email provider,{" "}
          <strong>Brevo</strong>. The Site itself doesn&apos;t store your address.
        </li>
        <li>We use your address only to send FunkSquish news, such as our launch and new drops.</li>
        <li>Every email has an unsubscribe link. You can also email us to be removed. We process opt-outs promptly.</li>
        <li>Our emails include a postal address for FunkSquish, as U.S. law requires.</li>
      </ul>

      <h3>Drop &amp; restock alerts ({status.dropAlerts})</h3>
      <p>
        If you ask for drop alerts, it works the same way as the launch list — consent box, confirmation email, stored by
        Brevo — but on a separate list. We use it only to email you when a new drop or a restock is announced. Unsubscribe
        anytime from any alert email.
      </p>

      <h3>Wishlists, Squish Boxes and quiz results</h3>
      <p>
        These are saved only in your own browser (local storage) so they&apos;re still there when you come back. They&apos;re never
        sent to us. If you share a wishlist or box link, the link contains short product codes (like grape-jelly-bear) and your box name, if
        you gave one — nothing else. Clearing your browser data deletes them.
      </p>

      <h3>Partner and supplier applications ({status.partners})</h3>
      <p>
        If a business applies through our <a href="/partners">partner page</a>, we store the answers (such as name, work
        email, business details and product information) privately with our host, Netlify, so we can review the application
        and reply. Only FunkSquish&apos;s owner can see them, after signing in. Our email provider, Brevo, sends us a short
        notice that an application arrived, without the applicant&apos;s contact details. To prevent spam we keep a keyed hash of
        the sender&apos;s IP address, not the address itself. Applicants are never added to marketing lists. We keep applications for
        up to 24 months after the last update unless we start working together, and delete them sooner on request.{" "}
        <Todo>owner/legal review of the partner-application retention period</Todo>
      </p>

      <h3>Website analytics ({status.analytics})</h3>
      <p>
        We use <strong>Umami</strong>, a privacy-focused analytics service, to count visits and see which pages are popular
        and how people find us (for example, from TikTok). Umami doesn&apos;t use cookies and doesn&apos;t build a profile of you. It
        records things like the page visited, the referring website, browser and device type, and country. It also counts a
        few actions, such as clicks on our TikTok links and completed email sign-ups — never what you type. We only use this
        in aggregate.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To reply to your messages and help with orders.</li>
        <li>To send launch emails or drop alerts, if you&apos;ve signed up and confirmed.</li>
        <li>To run, improve, and protect the Site.</li>
        <li>To meet legal obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share information only with service providers that run parts of our business on our behalf — currently Netlify
        (hosting and private application storage) and Google Workspace (email), and, once active, Brevo (email lists and
        notifications) and Umami (analytics) — or when required
        by law. We don&apos;t sell or rent personal information.
      </p>

      <h2>When our shop opens</h2>
      <p>
        Orders will be processed by a third-party checkout provider, which handles payment details. We will never see or
        store your full card number. Before taking orders we&apos;ll update this policy to name that provider and explain what
        order information (such as your name, shipping address, and order history) we keep and for how long.{" "}
        <Decision>checkout provider(s) and order-record retention period</Decision>
      </p>

      <h2>Children</h2>
      <p>
        The Site is meant for a general audience and isn&apos;t directed to children under 13. We don&apos;t knowingly collect
        personal information from children under 13. If you believe a child has sent us personal information, email us and
        we&apos;ll delete it. <Todo>legal review of children&apos;s privacy approach (COPPA)</Todo>
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask what personal information we have about you, ask us to correct or delete it, or unsubscribe from emails at
        any time by emailing <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. Depending on where you live, you may
        have additional rights under state law. <Todo>legal review of applicable state privacy laws</Todo>
      </p>

      <h2>Keeping information</h2>
      <p>
        We keep emails as long as needed to help you and for our records. Email-list subscribers are kept until they
        unsubscribe or ask to be deleted.
      </p>

      <h2>Security</h2>
      <p>
        We use reputable providers and limit access to business information. No method of storing or sending information is
        perfectly secure, but we work to protect it.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, or write to us at:
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
