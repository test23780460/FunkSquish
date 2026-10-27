import { LegalPage, Todo, Decision } from "@/components/layout/LegalPage";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { POLICIES } from "@/content/policies";
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
 * docs/MASTER-LEGAL-AUDIT.md and tests/legal/). The "active / not active yet"
 * labels come from the real build configuration (lib/integrations/status), so
 * they can't drift.
 */
const status = {
  newsletter: newsletterActive() ? "active" : "not active yet",
  dropAlerts: dropAlertsActive() ? "active" : "not active yet",
  partners: partnerApplicationsActive() ? "active" : "not active yet",
  analytics: analyticsActive() ? "active" : "not active yet",
};

const mail = `mailto:${siteConfig.email}`;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={POLICIES.privacy.lastUpdated}>
      <p>
        This Privacy Policy explains how FunkSquish (&ldquo;FunkSquish,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), operated by{" "}
        {siteConfig.legalOperator}, collects, uses and shares information when you visit <a href={siteConfig.url}>funksquish.com</a>{" "}
        (the &ldquo;Site&rdquo;), email us, apply as a partner, sign up for our emails or (once our shop opens) buy from us.
        FunkSquish is based in Kentucky, United States. Purchases made on TikTok Shop or another marketplace are also covered by that
        marketplace&apos;s own privacy policy.
      </p>

      <h2>Summary</h2>
      <ul>
        <li>We don&apos;t sell or rent your personal information, and we don&apos;t share it for targeted (cross-context behavioral) advertising.</li>
        <li>We don&apos;t use advertising cookies or tracking pixels. Our analytics don&apos;t use cookies and don&apos;t run if your browser sends a Do Not Track signal.</li>
        <li>The Site has no customer accounts. Checkout isn&apos;t open yet; when it is, card payments are handled by Stripe, and we never see your full card number.</li>
        <li>You can ask what we hold about you, and ask us to correct or delete it.</li>
      </ul>

      <h2>Information we collect, and why</h2>

      <h3>When you email us</h3>
      <p>
        We receive your email address and whatever you include, and use it to reply, help with your order and keep a record of the
        conversation. Our email is provided by <strong>Google Workspace</strong>.
      </p>

      <h3>When you visit the Site</h3>
      <p>
        Our website host, <strong>Netlify</strong>, automatically processes technical information such as your IP address, browser
        type and the pages you request, so it can deliver the Site and protect it from abuse. We don&apos;t use this to identify you.
      </p>

      <h3>Website analytics ({status.analytics})</h3>
      <p>
        We use <strong>Umami</strong>, a privacy-focused analytics service, to count visits and see which pages are popular and how
        people find us (for example, from TikTok). Umami doesn&apos;t use cookies and doesn&apos;t build a profile of you. For each visit it
        records the page address and title, the referring website, your browser, operating system, device type, screen size and
        language setting, and an approximate location (country, region and city) worked out from your IP address — Umami says it
        doesn&apos;t store the IP address itself.
      </p>
      <p>
        Before anything is sent, our Site removes extra information from page addresses: only marketing campaign tags (such as{" "}
        <code>utm_source</code>) are kept, so things like a Squish Box name in a shared link are never sent to Umami. Our private owner
        pages and checkout pages aren&apos;t counted at all. Analytics also count a few actions — clicks on our TikTok links, clicks on
        &ldquo;Buy&rdquo; links to TikTok Shop or another store, starting or finishing the quiz, starting a Squish Box, adding to or sharing a
        wishlist, using the Squish Lab, completed email sign-ups, and which partner category someone applied under — never what you
        type. We use analytics only in aggregate.
      </p>

      <h3>Launch email list ({status.newsletter})</h3>
      <ul>
        <li>
          You give your email address and tick a box agreeing to receive FunkSquish emails. You&apos;re only added after you click the
          link in our confirmation email (&ldquo;double opt-in&rdquo;).
        </li>
        <li>
          Your address and a record of when you signed up and confirmed are stored by our email provider, <strong>Brevo</strong>. The
          Site itself doesn&apos;t store your address.
        </li>
        <li>We use it only to send FunkSquish news, such as our launch and new drops.</li>
        <li>
          Every email has an unsubscribe link, and you can email us to be removed. We act on unsubscribe requests within 10 business
          days, as the law requires, and usually much sooner.
        </li>
      </ul>

      <h3>Drop &amp; restock alerts ({status.dropAlerts})</h3>
      <p>
        Works like the launch list — consent box, confirmation email, stored by Brevo — on a separate list used only to tell
        subscribers when a new drop or restock is announced. Alerts go to the whole list; we don&apos;t record which product you were
        looking at. Unsubscribe from any alert email.
      </p>

      <h3>Wishlists, Squish Boxes and quiz results</h3>
      <p>
        These are saved only in your own browser (local storage) and are never sent to us. A shared wishlist or box link contains
        product codes and the box name you chose, if any. Anyone you give the link to may see that information, and when the link is
        opened our host receives the address like any other page request (it isn&apos;t sent to our analytics). Clearing your browser
        data removes locally saved lists and results, but not links you&apos;ve already shared.
      </p>

      <h3>TikTok videos and links</h3>
      <p>
        Some pages show TikTok clips. They don&apos;t load anything from TikTok until you press play; once you do, TikTok&apos;s player
        loads from TikTok and TikTok&apos;s own privacy policy applies to what it collects. Links to our TikTok profile open TikTok
        directly.
      </p>

      <h3>Partner and supplier applications ({status.partners})</h3>
      <p>
        If a business applies through our <a href="/partners">partner page</a>, we store its answers — such as name, work email,
        business and website details, country, and what it tells us about products, pricing, shipping, safety documentation and where
        we may sell — privately with Netlify, so we can review the application and reply. Only FunkSquish&apos;s owner can see them,
        after signing in. Applications are never approved automatically: a person reviews each one, and nothing is agreed until both
        sides sign a written agreement. Brevo sends us a short notice that an application arrived (its reference, business name and
        country, without contact details). Applicants are never added to marketing lists. We treat pricing, terms and safety answers
        as confidential: we don&apos;t publish them, and we share them only with our professional advisers or when the law requires it.
      </p>
      <p>
        To prevent spam, we make scrambled codes (keyed hashes) from the applicant&apos;s IP address and email address. The codes used
        for rate limits are deleted automatically after 2 days. One code made from the IP address is also kept with the
        application, so we can spot repeated abuse, and is deleted together with the application. We never store the IP address
        itself. (The email address you type into the form is, of course, stored as part of your application so we can reply.)
      </p>
      <p>
        <strong>How long we keep applications.</strong> An automatic daily cleanup deletes declined applications{" "}
        {RETENTION.declinedMonths} months after the last activity on them, and other applications — including future reseller or
        distributor interest — {RETENTION.openMonths} months after the last activity (the application itself, a change in its review
        stage, or a note we add). If we start working together, we keep the application while the relationship is active, review it
        at least once a year, and delete it when it&apos;s no longer needed. We keep something longer only if the law requires it or
        there&apos;s an active legal dispute, and we record why. A short record of each deletion request (dates, a scrambled code of
        the requester&apos;s email, the references deleted and the outcome) is kept for {RETENTION.deletionRecordMonths} months so we can
        show it was handled.
      </p>

      <h3>When you buy from us (not active yet)</h3>
      <Decision>checkout launch date, payment methods and order-record retention period</Decision>
      <p>
        Orders will be paid through <strong>Stripe</strong>&apos;s secure checkout page. You type your card details on Stripe&apos;s page,
        not ours — we never see or store your full card number. Stripe processes your payment and may use the information to prevent
        fraud, under its own privacy policy. If Stripe offers to save your details with its own Link service, that choice is between
        you and Stripe.
      </p>
      <p>To fulfil and support your order we receive and keep an order record with:</p>
      <ul>
        <li>your name, email address and shipping address (and any phone number you choose to give);</li>
        <li>what you bought, the prices, shipping and tax charged, and any discount;</li>
        <li>payment status and references from Stripe (not your card number), refunds, any payment dispute, and shipping and tracking details.</li>
      </ul>
      <p>
        Order records are stored privately with Netlify and are visible only to FunkSquish&apos;s owner after signing in. If an item
        ships directly from one of our suppliers, we share only what they need to deliver it — your name, shipping address and the
        items — with that supplier, and we require them to use it only for that delivery. We keep order records for{" "}
        <strong>[period to be decided]</strong> for tax, accounting, warranty, product-safety and fraud-prevention purposes, then
        delete them. <Todo>attorney/accountant: required order-record retention period</Todo>
      </p>
      <p>
        We email you about your order (confirmation, shipping and tracking, and anything that needs your attention, such as a delay
        or a product-safety notice). These are transactional emails sent through Brevo, not marketing, and don&apos;t add you to any
        list. Stripe may also email you a payment receipt.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To reply to messages, review partner applications and, once the shop opens, process, deliver and support orders.</li>
        <li>To send launch emails or drop alerts, only if you&apos;ve signed up and confirmed.</li>
        <li>To tell buyers about a product-safety issue or recall affecting something they bought.</li>
        <li>To run, secure, improve and protect the Site, and to prevent and investigate fraud, abuse and payment disputes.</li>
        <li>To meet legal, tax and accounting obligations, and to establish or defend legal claims.</li>
      </ul>
      <p>We don&apos;t use personal information for purposes that aren&apos;t compatible with these without telling you first.</p>

      <h2>Who we share it with</h2>
      <p>We share personal information only as described here:</p>
      <ul>
        <li><strong>Netlify</strong> — website hosting and private storage of partner applications and (later) orders.</li>
        <li><strong>Google Workspace</strong> — our email.</li>
        <li><strong>Brevo</strong> — our email lists (if you sign up), order and shipping emails (once the shop opens), and notices to us about partner applications.</li>
        <li><strong>Umami</strong> — cookie-free website analytics ({status.analytics}).</li>
        <li><strong>Stripe</strong> — card payments, once checkout opens.</li>
        <li>Shipping carriers and, for supplier-shipped items, the supplier — the details needed to deliver an order.</li>
        <li>TikTok — only if you press play on a TikTok clip or buy through TikTok Shop, under TikTok&apos;s terms.</li>
        <li>
          Payment disputes — if you dispute a charge, we give Stripe and your card issuer the order, delivery and contact records
          needed to respond.
        </li>
        <li>
          Professional advisers (such as our attorney or accountant), and government authorities when the law requires it — for
          example a valid legal request, or a product-safety report to the U.S. Consumer Product Safety Commission.
        </li>
        <li>
          A new owner, if the FunkSquish business is sold or transferred. They would have to keep using it as this policy describes.
        </li>
      </ul>
      <p>We don&apos;t sell or rent personal information, and we don&apos;t share it for cross-context behavioral advertising.</p>

      <h2>Where information is processed</h2>
      <p>
        Our providers may process or store information in the United States and other countries, depending on their services and
        configurations (Brevo, for example, is a company based in Europe). We choose established providers and only send them what
        their service needs. <Todo>owner: confirm each provider&apos;s data region in its account settings</Todo>
      </p>

      <h2>Children</h2>
      <p>
        We intend the Site for a general audience, rather than specifically for children under 13. This statement doesn&apos;t by
        itself determine how children&apos;s privacy law classifies the Site. We don&apos;t knowingly collect personal information from
        children under 13. Our email sign-up, partner and (future) checkout forms are meant to be completed by adults, and purchases
        must be made by an adult (see our Terms). Wishlists, the quiz and the Squish Box stay in the browser and aren&apos;t sent to
        us. If you believe a child has sent us personal information, email us and we&apos;ll delete it.{" "}
        <Todo>legal review of children&apos;s privacy approach (COPPA, including the 2025 amendments), given that squishies appeal to children</Todo>
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>Ask, correct or delete.</strong> You can ask what personal information we hold about you, and ask us to correct or
          delete it, by emailing <a href={mail}>{siteConfig.email}</a> or writing to the address below. You can also ask someone to
          make the request for you; we&apos;ll need proof they&apos;re allowed to.
        </li>
        <li>
          <strong>How we check it&apos;s you.</strong> We&apos;ll reply to the email address on our records. Before sharing order details or
          a delivery address, we may ask for your order number and other details only the buyer would know. Access to an email
          inbox alone may not be enough for sensitive details, and we&apos;ll never ask for your card number or a password.
        </li>
        <li>
          <strong>When we&apos;ll respond.</strong> We aim to respond within 30 days, or sooner if the law requires. If we need more
          time where the law allows it, we&apos;ll tell you why.
        </li>
        <li>
          <strong>What we may keep.</strong> We may keep information we&apos;re legally required to keep (such as order records needed
          for taxes) or that&apos;s needed for an active legal dispute, and we&apos;ll tell you if so. If we turn down a request, we&apos;ll
          explain why, and you can ask us to reconsider by replying.
        </li>
        <li>Unsubscribe from marketing emails at any time with the link in each email. We won&apos;t treat you differently for using any of these choices.</li>
        <li>
          Depending on where you live, you may have additional rights under state law.{" "}
          <Todo>legal review of applicable state privacy laws (including Kentucky&apos;s) and whether any thresholds apply</Todo>
        </li>
      </ul>

      <h2>How long we keep information</h2>
      <ul>
        <li>Emails with us: as long as needed for customer support and legitimate business and legal purposes; the precise schedule is under review.</li>
        <li>Email-list subscribers: until they unsubscribe or ask to be deleted (Brevo may keep a record of the unsubscribe so you aren&apos;t emailed again).</li>
        <li>Partner applications: the schedule above, enforced automatically. Spam-prevention codes: 2 days.</li>
        <li>Orders: the period stated above, once decided.</li>
        <li>Analytics records: kept by Umami under its data-retention settings. They don&apos;t contain your name, email or IP address.</li>
        <li>Website request logs: kept by Netlify under its own retention settings.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Private application and order records are stored with Netlify and are meant to be reachable only through a signed-in owner
        area, not public pages. We avoid placing customer details in application logs and never in our public source code. Card
        payments are entered on Stripe&apos;s encrypted checkout page. No method of storing or sending information is perfectly
        secure, but we work to protect it. If a security incident affects your personal information, we&apos;ll notify you and any
        authorities as the law requires.
      </p>

      <h2>Do Not Track and Global Privacy Control</h2>
      <p>
        Our analytics don&apos;t run when your browser sends a Do Not Track signal. We don&apos;t track you across other websites, and we
        don&apos;t sell or share personal information for targeted advertising, so there&apos;s nothing for a Global Privacy Control signal
        to opt you out of.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The date at the top shows when it last changed, and we keep earlier versions. If we make a
        material change to how we use personal information, we&apos;ll say so on this page before it takes effect, and we won&apos;t apply
        it to information we collected earlier without your consent where the law requires it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests? Email <a href={mail}>{siteConfig.email}</a>, or write to us at:
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
