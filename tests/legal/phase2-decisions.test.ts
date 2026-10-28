import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { renderPage, visibleText } from "./render";
import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";
import Shipping from "@/app/shipping/page";
import Returns from "@/app/returns/page";
import OrderHelp from "@/app/order-help/page";
import Faq from "@/app/faq/page";
import Partners from "@/app/partners/page";
import { POLICIES } from "@/content/policies";
import { metadata as returnsMeta } from "@/app/returns/page";

/**
 * The owner's Phase 2 directions (2026-10-27), checked against what customers
 * will read. Each block names the direction it pins down.
 */
const pages = { privacy: Privacy, terms: Terms, shipping: Shipping, returns: Returns, orderHelp: OrderHelp, faq: Faq, partners: Partners };
const text = {} as Record<keyof typeof pages, string>;
for (const [k, P] of Object.entries(pages)) text[k as keyof typeof pages] = visibleText(await renderPage(P as never));

describe("mixed-order shipping (one checkout, separate packages, no surprise charges)", () => {
  it("explains the per-package calculation and that mixed orders can cost more", () => {
    expect(text.shipping).toMatch(/Items that ship from the same place are packed together in one package with one shipping charge/);
    expect(text.shipping).toMatch(/items from a different place ship in a separate package with its own charge/);
    expect(text.shipping).toMatch(/can cost more to ship than an order from one place/);
  });

  it("shows all shipping charges and the total before payment, and never adds charges later", () => {
    expect(text.shipping).toMatch(/combined shipping charge, any sales tax, and your order total before you pay/);
    expect(text.shipping).toMatch(/we never add shipping charges after you pay/);
    expect(text.terms).toMatch(/We won't add charges after checkout, however many packages your order ships in/);
    expect(text.faq).toMatch(/we never add shipping later/);
    // The old one-charge-for-everything promise is gone.
    expect(text.shipping).not.toMatch(/covers your whole order/);
  });

  it("never guesses: items without confirmed rates aren't sold", () => {
    expect(text.shipping).toMatch(/If we can't calculate shipping for an item from confirmed rates, we don't sell it until we can/);
  });

  it("separate deadlines, tracking, delays, losses and returns per package", () => {
    expect(text.shipping).toMatch(/Each package has its own ship-by date/);
    expect(text.shipping).toMatch(/We'll email you each package's tracking number/);
    expect(text.shipping).toMatch(/a delay to one package doesn't change the others/);
    expect(text.shipping).toMatch(/refund that package in full \(its items, its shipping charge and any tax\)/);
    expect(text.shipping).toMatch(/can't be sent to APO\/FPO\/DPO addresses/);
    expect(text.returns).toMatch(/we can cancel the packages that haven't — refunding their items, their shipping charges and any tax/);
  });

  it("doesn't advertise signature confirmation (not decided yet)", () => {
    for (const t of Object.values(text)) expect(t).not.toMatch(/signature confirmation/i);
  });
});

describe("returns that don't qualify (no automatic disposal)", () => {
  it("explains why, offers return at the buyer's expense, and handles unclaimed items by law", () => {
    expect(text.returns).toMatch(/we'll email you to explain why and offer to send it back to you at your expense/);
    expect(text.returns).toMatch(/We won't throw it away just because time has passed: if it's never claimed, we'll handle it as the law requires/);
    expect(text.returns).not.toMatch(/dispose/i);
  });

  it("keeps evidence for disputes and preserves statutory rights", () => {
    expect(text.returns).toMatch(/connected to an open card dispute, chargeback or legal claim, we keep the item and the records/);
    expect(text.returns).toMatch(/the damaged, defective or wrong-item rules above apply instead/);
    expect(text.returns).toMatch(/Nothing in this policy limits any rights you have under applicable consumer protection laws/);
  });

  it("stays in draft for legal review", () => {
    expect(POLICIES.returns.status).toBe("draft");
    expect(text.returns).toContain("Draft — not yet in effect");
    expect(returnsMeta.robots).toMatchObject({ index: false });
  });
});

describe("shipping decisions 1–10", () => {
  it("D.C., the 2-business-day definition, lost packages, undeliverable refunds, tax, damage review, shipped, refund timing", () => {
    expect(text.shipping).toMatch(/Washington, D\.C\./);
    expect(text.shipping).toMatch(/by the end of the second business day after the day we receive your paid order/);
    expect(text.shipping).toMatch(/excluding U\.S\. federal holidays, and days are counted in U\.S\. Eastern Time/);
    expect(text.shipping).toMatch(/we'll send a replacement at no cost or refund that package in full/);
    expect(text.shipping).toMatch(/reship it at no cost or refund it in full, your choice/);
    expect(text.shipping).toMatch(/within 5 business days after it reaches us/);
    expect(text.returns).toMatch(/refund of the item price and any sales tax charged on it/);
    expect(text.returns).toMatch(/we aim to review claims within 2 business days \(some take longer/);
    expect(text.returns).toMatch(/An item has "shipped" once it's been handed to the carrier/);
    expect(text.returns).toMatch(/within 5 business days after we receive the return/);
  });
});

describe("privacy and partner directions", () => {
  it("30-day response aim, recalls, verification, supplier data limits, accurate security claims", () => {
    expect(text.privacy).toMatch(/We aim to respond within 30 days, or sooner if the law requires/);
    expect(text.privacy).toMatch(/To tell buyers about a product-safety issue or recall/);
    expect(text.privacy).toMatch(/Before sharing order details or a delivery address, we may ask for your order number/);
    expect(text.privacy).toMatch(/We sell supplier-shipped items only once a written agreement with that supplier is in place/);
    expect(text.privacy).toMatch(/never for their own marketing/);
    expect(text.privacy).toMatch(/before we take customer orders or open partner applications,\s+two-step sign-in/);
    // Checkout abuse limits (PR #16): keyed hashes only, deleted after 2 days — matches src/commerce/checkout/rate-limit.ts.
    expect(text.privacy).toMatch(/scrambled code \(a keyed hash\) from your IP address — never\s+storing the address itself — and the codes are deleted by our daily automatic cleanup once they.re 2 days old/);
    expect(text.privacy).toMatch(/\[period to be decided\]/); // order retention stays open until the accountant/attorney answer
    expect(text.privacy).not.toMatch(/\b(unhackable|bank-level|military-grade|100% secure|completely secure)\b/i);
  });

  it("partner notice: realistic confidentiality, justified legal exceptions explained", () => {
    expect(text.partners).toMatch(/we share them only with our professional advisers or when the law requires it/);
    expect(text.partners).toMatch(/unless the law requires us to keep it or it's part of an active legal dispute, in which case we'll tell you why/);
  });
});

describe("terms directions", () => {
  it("pricing errors: express agreement, cancel and refund if declined, deadlines kept", () => {
    expect(text.terms).toMatch(/We won't charge you more than the price you agreed to at checkout without your express permission/);
    expect(text.terms).toMatch(/We'll only charge a corrected price if you expressly agree to it/);
    expect(text.terms).toMatch(/If you decline, or don't choose before the item's ship-by date, we'll cancel and refund it/);
    expect(text.terms).toMatch(/the shipping and cancellation timeframes in our Shipping Policy still apply/);
  });

  it("quantity limits are explained before checkout; excess units are refunded in full", () => {
    expect(text.terms).toMatch(/One order can include up to 10 of each item and up to 20 different items/);
    expect(text.terms).toMatch(/we may cancel the extra units and refund them in full, including any shipping charged for them/);
  });

  it("cards and card wallets at launch; stays Draft", () => {
    expect(text.terms).toMatch(/including card wallets such as Apple Pay and Google Pay/);
    expect(text.terms).toMatch(/We don't offer pay-later or bank-transfer payments/);
    expect(POLICIES.terms.status).toBe("draft");
    expect(POLICIES.privacy.status).toBe("draft");
  });
});
