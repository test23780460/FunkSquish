import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { siteConfig } from "@/lib/site";
import { cancellationEmail, customerConfirmationEmail, delayNoticeEmail, ownerOrderEmail, refundEmail, shippingEmail, trackingUpdateEmail } from "@/commerce/orders/notify";
import type { Order } from "@/commerce/orders/types";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { OwnerShell, PageTitle, card } from "@/components/owner/OwnerUi";

export const metadata: Metadata = { title: "Customer email previews", robots: { index: false, follow: false } };

/**
 * PRIVATE: every order email customers can get, rendered with a FICTIONAL
 * sample order — so the wording can be reviewed before launch. Nothing is
 * sent from this page. Real emails go out only for real, verified order
 * events (and never for test-mode orders unless explicitly enabled).
 */
export default function EmailsPage() {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Emails />
    </OwnerShell>
  );
}

/** A made-up order: two packages (our studio + a supplier), a replacement and a package refund. */
function sampleOrder(): Order {
  const at = "2026-11-02T15:00:00.000Z";
  return {
    id: "FS-SAMPLE-0001",
    mode: "test",
    checkoutId: "sample",
    stripeCheckoutSessionId: "cs_test_SAMPLEPREVIEW00",
    stripePaymentIntentId: null,
    status: "partially_fulfilled",
    paymentStatus: "partially_refunded",
    amounts: { currency: "usd", subtotal: 2600, shipping: 950, tax: 0, discount: 0, total: 3550 },
    lineItems: [
      { variantId: "a", productId: "a", sku: "SAMPLE-1", name: "Sample Jelly Squishy (Pink)", quantity: 2, unitAmount: 900, amountTotal: 1800, fulfillmentSource: "in_house", fulfillmentOrigin: "funksquish" },
      { variantId: "b", productId: "b", sku: "SAMPLE-2", name: "Sample Slushie Squishy", quantity: 1, unitAmount: 800, amountTotal: 800, fulfillmentSource: "supplier", fulfillmentOrigin: "supplier-a" },
    ],
    fulfillments: [
      { id: "funksquish", source: "in_house", origin: "funksquish", shippingAmount: 500, processingBusinessDays: 2, supplierRef: null, variantIds: ["a"], status: "shipped", carrier: "USPS", trackingNumber: "9400100000000000000000", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000", shippedAt: at, deliveredAt: null, shipBy: "2026-11-04", previousShipments: [{ carrier: "USPS", trackingNumber: "9400199999999999999999", shippedAt: at, outcome: "lost", at }] },
      { id: "supplier-a", source: "supplier", origin: "supplier-a", shippingAmount: 450, processingBusinessDays: 5, supplierRef: null, variantIds: ["b"], status: "awaiting_supplier", carrier: null, trackingNumber: null, trackingUrl: null, shippedAt: null, deliveredAt: null, shipBy: "2026-11-09" },
    ],
    customer: { email: "sample.customer@example.com", name: "Sample Customer", phone: null },
    shippingAddress: { name: "Sample Customer", line1: "1 Example Street", line2: null, city: "Sampletown", state: "KY", postalCode: "40000", country: "US" },
    shippingRateId: null,
    refunds: [{ stripeRefundId: "re_SAMPLE", amount: 1250, reason: null, createdAt: at, groupId: "supplier-a" }],
    inventoryCommitted: true,
    flags: [],
    createdAt: at,
    updatedAt: at,
    history: [],
  };
}

async function Emails() {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const o = sampleOrder();
  const cfg = { siteUrl: siteConfig.url, contactEmail: siteConfig.email };
  const emails: { when: string; subject: string; html: string }[] = [
    { when: "Payment verified (sent once per order)", ...customerConfirmationEmail(o, cfg) },
    { when: "A package ships (once per package)", ...shippingEmail({ ...o, fulfillments: [{ ...o.fulfillments[0], previousShipments: [] }, o.fulfillments[1]] }, "funksquish") },
    { when: "A replacement ships after a loss or return", ...shippingEmail(o, "funksquish") },
    { when: "You change the tracking number of a shipped package", ...trackingUpdateEmail(o, "funksquish") },
    { when: "A package will miss its ship-by date (delay notice, before the date)", ...delayNoticeEmail(o, "supplier-a", { newShipBy: "2026-11-16", originalShipBy: "2026-11-09", expressConsentNeeded: false, cancelBy: null }, cfg) },
    { when: "Delay over 30 days or no date (customer must agree)", ...delayNoticeEmail(o, "supplier-a", { newShipBy: null, originalShipBy: "2026-11-09", expressConsentNeeded: true, cancelBy: "2026-11-30" }, cfg) },
    { when: "You refund a package or part of an order", ...refundEmail(o, o.refunds[0], cfg) },
    { when: "You cancel the whole order", ...cancellationEmail({ ...o, status: "canceled", refunds: [{ ...o.refunds[0], amount: 3550, groupId: null }] }, cfg) },
    { when: "To you: a new paid order (no customer contact details)", ...ownerOrderEmail(o, `${siteConfig.url}/partners/review/orders`) },
  ];
  return (
    <div>
      <OwnerNav current="orders" />
      <PageTitle
        title="Customer email previews"
        lead="Every email an order can trigger, shown with a made-up sample order. Nothing is sent from here. Real ones go out only for real, verified events — never for test orders unless switched on — and each at most once. [TEST] in a subject means a test-mode order."
      />
      <ul className="grid gap-5">
        {emails.map((e) => (
          <li key={e.when} className={card}>
            <p className="text-sm font-semibold text-ink-soft">{e.when}</p>
            <p className="mt-1 font-display text-lg font-bold text-ink">{e.subject}</p>
            <iframe title={`Preview: ${e.subject}`} srcDoc={e.html} sandbox="" className="mt-3 h-80 w-full rounded-2xl bg-white ring-1 ring-inset ring-sky-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}
