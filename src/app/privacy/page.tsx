import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy (draft)",
  description: "Draft privacy policy for FunkSquish. Pending owner review.",
  path: "/privacy",
  noindex: true,
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 23, 2026">
      <p>
        This Privacy Policy explains how FunkSquish (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
        operated by <Todo>legal business name and entity type</Todo>, handles information when you visit{" "}
        <a href={siteConfig.url}>funksquish.com</a> (the &ldquo;Site&rdquo;).
      </p>

      <h2>What we collect right now</h2>
      <p>FunkSquish has not launched yet. At this stage the Site has no accounts, no active sign-up forms, and no checkout.</p>
      <ul>
        <li>
          <strong>Emails you send us.</strong> If you email us, we receive your email address and anything you include in
          your message. Our email is provided by Google Workspace.
        </li>
        <li>
          <strong>Technical data.</strong> Our website host, Netlify, automatically processes technical information such as
          IP address, browser type, and pages requested in order to deliver and secure the Site.
        </li>
        <li>
          <strong>No analytics or advertising cookies.</strong> We do not currently use analytics, tracking pixels, or
          advertising cookies.
        </li>
      </ul>

      <h2>Launch email list (not active yet)</h2>
      <p>
        We plan to offer an optional email list to tell people when the shop opens. It is switched off until this policy is
        finalized. <Decision>before enabling sign-ups, confirm the provider (planned: Brevo) and replace this section with the final wording</Decision>
      </p>
      <p>Planned approach, for review:</p>
      <ul>
        <li>You only join if you tick a consent box and then confirm from a confirmation email (double opt-in).</li>
        <li>We collect your email address and the date you signed up and confirmed.</li>
        <li>Every email includes an unsubscribe link, and you can ask us to delete your address at any time.</li>
        <li>Your address is stored by our email provider, not on this website.</li>
      </ul>

      <h2>Website analytics (not active yet)</h2>
      <p>
        <Decision>if privacy-friendly analytics is turned on (planned: Umami Cloud — cookieless, no personal profiles), describe it here before enabling</Decision>
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To reply to your messages.</li>
        <li>To run, maintain, and protect the Site.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share it only with service providers that help us run the Site or our
        email (such as Netlify and Google Workspace), or when required by law.
      </p>

      <h2>Links to other sites</h2>
      <p>The Site links to TikTok and other third-party services. Their own privacy policies apply when you use them.</p>

      <h2>When our shop opens</h2>
      <p>
        Before we sell anything, we will update this policy to explain what we collect for orders, shipping, and customer
        support. Payments will be handled by a third-party payment provider; we will not see or store full card numbers.{" "}
        <Decision>name the checkout/payment provider (e.g. Shopify, TikTok Shop), shipping provider, and how long order records are kept</Decision>
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        The Site is not directed to children under 13 and we do not knowingly collect their personal information.{" "}
        <Todo>Owner/legal review: approach for younger customers and parental consent (e.g. COPPA)</Todo>
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask what personal information we hold about you, or ask us to delete it, by emailing{" "}
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.{" "}
        <Todo>Owner/legal review: state privacy laws that apply to the business</Todo>
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.{" "}
        <Todo>business mailing address, if required — do not use a home address without considering privacy</Todo>
      </p>
    </LegalPage>
  );
}
