import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service (draft)",
  description: "Draft terms of service for FunkSquish. Pending owner review.",
  robots: { index: false },
};

const Todo = ({ children }: { children: string }) => <span className="todo">[{children}]</span>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="October 22, 2026">
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

      <h2>Future purchases</h2>
      <p>
        When our shop opens, additional terms will cover orders, pricing, payment, shipping, returns, and exchanges.{" "}
        <Todo>Add sales terms, shipping policy, and return policy before launch.</Todo>
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Site is provided &ldquo;as is.&rdquo; <Todo>Owner/legal review: disclaimers and limitation of liability.</Todo>
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
