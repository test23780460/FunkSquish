import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy (draft)",
  description: "Draft privacy policy for FunkSquish. Pending owner review.",
  robots: { index: false },
};

const Todo = ({ children }: { children: string }) => <span className="todo">[{children}]</span>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 22, 2026">
      <p>
        This Privacy Policy explains how FunkSquish (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
        operated by <Todo>legal business name</Todo>, handles information when you visit{" "}
        <a href={siteConfig.url}>funksquish.com</a> (the &ldquo;Site&rdquo;).
      </p>

      <h2>What we collect right now</h2>
      <p>FunkSquish has not launched yet. At this stage the Site does not offer accounts, sign-up forms, or checkout.</p>
      <ul>
        <li>
          <strong>Emails you send us.</strong> If you email us, we receive your email address and anything you include
          in your message.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting provider <Todo>e.g. Vercel</Todo> may automatically process
          technical information such as IP address, browser type, and pages requested, in order to deliver and secure
          the Site.
        </li>
        <li>
          <strong>No analytics or advertising cookies.</strong> We do not currently use analytics, tracking pixels, or
          advertising cookies. <Todo>Update this section if any are added.</Todo>
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To reply to your messages.</li>
        <li>To run, maintain, and protect the Site.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share it only with service providers that help us run the Site
        or our email (for example, our hosting and email providers), or when required by law.
      </p>

      <h2>Links to other sites</h2>
      <p>
        The Site links to TikTok and other third-party services. Their own privacy policies apply when you use them.
      </p>

      <h2>When our shop opens</h2>
      <p>
        Before we sell products or collect sign-ups, we will update this policy to explain what we collect for orders,
        shipping, and email updates. Payments will be handled by a third-party payment provider; we will not store full
        card numbers on our own systems. <Todo>Name payment, email, and shipping providers once chosen.</Todo>
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        The Site is not designed to collect personal information from children under 13.{" "}
        <Todo>Owner review: confirm approach for younger customers and parental consent (e.g. COPPA).</Todo>
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask us what personal information we hold about you, or ask us to delete it, by emailing{" "}
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.{" "}
        <Todo>Owner review: add any state-specific rights that apply.</Todo>
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
      </p>
    </LegalPage>
  );
}
