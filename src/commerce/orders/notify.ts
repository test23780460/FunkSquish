import { orderKey } from "./fulfill";
import { updateWithRetry, type KvStore } from "./store";
import type { NotificationRecord, Order } from "./types";

/**
 * Order emails (transactional, never marketing):
 *  - customer confirmation once the payment is verified;
 *  - owner alert for each new paid order (no customer contact details — those
 *    are only shown in the signed-in owner area);
 *  - shipping notice with tracking when the owner marks a package shipped.
 *
 * Each email is CLAIMED with a compare-and-set write before it's sent, so the
 * webhook, Stripe's retries and the success page can all run at once and the
 * customer still gets exactly one email. A failed send can be retried from
 * the owner page. In test mode nothing is sent unless explicitly enabled, so
 * test orders never email real people by accident.
 */

export interface Mailer {
  send(message: { to: string; subject: string; html: string; tag: string }): Promise<{ ok: true } | { ok: false; code: string }>;
}

export interface NotifyConfig {
  mailer: Mailer | null;
  ownerEmail: string | null;
  ownerOrdersUrl: string;
  /** Test mode sends only when this is true. */
  sendInTestMode: boolean;
  siteUrl: string;
  contactEmail: string;
}

type Slot = "customer" | "owner" | `shipping:${string}`;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function readSlot(order: Order, slot: Slot): NotificationRecord | undefined {
  if (slot === "customer" || slot === "owner") return order.notifications?.[slot];
  return order.notifications?.shipping?.[slot.slice("shipping:".length)];
}

function writeSlot(order: Order, slot: Slot, record: NotificationRecord) {
  order.notifications ??= {};
  if (slot === "customer" || slot === "owner") order.notifications[slot] = record;
  else (order.notifications.shipping ??= {})[slot.slice("shipping:".length)] = record;
}

/** Take the right to send one email. False if it was already sent, skipped, or is being sent. */
export async function claim(store: KvStore, sessionId: string, slot: Slot, now: Date): Promise<boolean> {
  const { changed } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current) return undefined;
    const existing = readSlot(current, slot);
    // A "sending" claim older than 10 minutes is treated as abandoned (the process died mid-send).
    const stale = existing?.status === "sending" && now.getTime() - Date.parse(existing.at) > 10 * 60_000;
    if (existing && existing.status !== "failed" && !stale) return undefined;
    writeSlot(current, slot, { status: "sending", at: now.toISOString() });
    return current;
  });
  return changed;
}

async function finish(store: KvStore, sessionId: string, slot: Slot, record: NotificationRecord) {
  await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current) return undefined;
    writeSlot(current, slot, record);
    return current;
  });
}

async function sendOnce(store: KvStore, order: Order, slot: Slot, cfg: NotifyConfig, now: Date, build: () => { to: string | null; subject: string; html: string; tag: string }) {
  if (!(await claim(store, order.stripeCheckoutSessionId, slot, now))) return;
  const at = now.toISOString();
  if (order.mode === "test" && !cfg.sendInTestMode) return finish(store, order.stripeCheckoutSessionId, slot, { status: "skipped", at, code: "test-mode" });
  const msg = build();
  if (!cfg.mailer || !msg.to) return finish(store, order.stripeCheckoutSessionId, slot, { status: "failed", at, code: !cfg.mailer ? "not-configured" : "no-address" });
  const result = await cfg.mailer.send({ ...msg, to: msg.to });
  await finish(store, order.stripeCheckoutSessionId, slot, result.ok ? { status: "sent", at } : { status: "failed", at, code: result.code });
}

const prefix = (order: Order) => (order.mode === "test" ? "[TEST] " : "");

function itemsTable(order: Order) {
  const rows = order.lineItems.map((l) => `<tr><td>${esc(l.name)} × ${l.quantity}</td><td align="right">${money(l.amountTotal)}</td></tr>`).join("");
  const a = order.amounts;
  const extra = [
    ["Subtotal", a.subtotal],
    ["Shipping", a.shipping],
    ...(a.discount ? [["Discount", -a.discount] as [string, number]] : []),
    ...(a.tax ? [["Tax", a.tax] as [string, number]] : []),
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td align="right">${money(v as number)}</td></tr>`)
    .join("");
  return `<table cellpadding="6" style="border-collapse:collapse;min-width:280px">${rows}${extra}<tr><td><b>Total</b></td><td align="right"><b>${money(a.total)}</b></td></tr></table>`;
}

export function customerConfirmationEmail(order: Order, cfg: Pick<NotifyConfig, "siteUrl" | "contactEmail">) {
  const addr = order.shippingAddress;
  const address = addr ? [addr.name, addr.line1, addr.line2, [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")].filter(Boolean).map(esc).join("<br>") : "";
  const supplier = order.fulfillments.some((f) => f.source === "supplier");
  return {
    subject: `${prefix(order)}Your FunkSquish order ${order.id}`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c">
<h2>Thanks for your order${order.customer.name ? `, ${esc(order.customer.name.split(" ")[0])}` : ""}!</h2>
<p>We've received your order <b>${esc(order.id)}</b> and your payment. We'll email your tracking number when it ships.</p>
${itemsTable(order)}
${address ? `<p><b>Shipping to</b><br>${address}</p>` : ""}
<p>Items from our own stock ship within 2 business days.${supplier ? " Items shipped by our supplier partner ship within the processing time shown on their product page when you ordered, and may arrive separately." : ""} If anything will be late, we'll email you before the ship-by date with your options, including a full refund.</p>
<p>Questions? Reply to this email or write to ${esc(cfg.contactEmail)}. See our <a href="${esc(cfg.siteUrl)}/shipping">Shipping</a> and <a href="${esc(cfg.siteUrl)}/returns">Returns</a> policies.</p>
</body></html>`,
  };
}

export function ownerOrderEmail(order: Order, ordersUrl: string) {
  const items = order.lineItems.reduce((n, l) => n + l.quantity, 0);
  const flags = order.flags.length ? `<p style="color:#b8215a"><b>Needs attention:</b> ${order.flags.map(esc).join(", ")}</p>` : "";
  return {
    subject: `${prefix(order)}New order ${order.id} — ${money(order.amounts.total)}`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c">
<h2>New paid order ${esc(order.id)}</h2>
<p>${items} item(s), ${money(order.amounts.total)} total.${order.fulfillments.some((f) => f.source === "supplier") ? " Includes supplier-shipped items — place those with the supplier manually." : ""}</p>
${flags}
<p><a href="${esc(ordersUrl)}">Open it in the private owner area</a> (sign-in required). Customer details are only shown there.</p>
</body></html>`,
  };
}

export function shippingEmail(order: Order, groupId: string) {
  const g = order.fulfillments.find((f) => f.id === groupId);
  const tracking = g?.trackingUrl ? `<a href="${esc(g.trackingUrl)}">${esc(g.trackingNumber)}</a>` : esc(g?.trackingNumber);
  return {
    subject: `${prefix(order)}Your FunkSquish order ${order.id} has shipped`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c">
<h2>It's on its way!</h2>
<p>Part or all of your order <b>${esc(order.id)}</b> shipped${g?.carrier ? ` with ${esc(g.carrier)}` : ""}.</p>
<p>Tracking: ${tracking}</p>
<p>If anything arrives damaged, defective or wrong, please email us — ideally within 7 days of delivery, with photos if you can. See our Returns policy.</p>
</body></html>`,
  };
}

/** Called after an order is (or becomes) paid. Safe to call any number of times. */
export async function notifyPaidOrder(store: KvStore, order: Order, cfg: NotifyConfig, now = new Date()) {
  await sendOnce(store, order, "customer", cfg, now, () => ({ to: order.customer.email, tag: "order-confirmation", ...customerConfirmationEmail(order, cfg) }));
  await sendOnce(store, order, "owner", cfg, now, () => ({ to: cfg.ownerEmail, tag: "order-owner", ...ownerOrderEmail(order, cfg.ownerOrdersUrl) }));
}

export async function notifyShipped(store: KvStore, order: Order, groupId: string, cfg: NotifyConfig, now = new Date()) {
  await sendOnce(store, order, `shipping:${groupId}`, cfg, now, () => ({ to: order.customer.email, tag: "order-shipped", ...shippingEmail(order, groupId) }));
}

/** Brevo transactional email. */
export function brevoMailer(apiKey: string, from: string): Mailer {
  return {
    async send({ to, subject, html, tag }) {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ sender: { name: "FunkSquish", email: from }, to: [{ email: to }], replyTo: { email: from }, subject, htmlContent: html, tags: [tag] }),
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok ? { ok: true } : { ok: false, code: `brevo-${res.status}` };
      } catch (err) {
        return { ok: false, code: (err as Error)?.name === "TimeoutError" ? "timeout" : "network" };
      }
    },
  };
}

/**
 * Delay notice (FTC Mail Order Rule, 16 CFR 435.2(b)): the revised date (or that
 * we can't give one), a free way to cancel for a full refund, and what happens
 * if the customer doesn't reply. Matches the Shipping Policy's "If your order
 * is delayed" section.
 */
export function delayNoticeEmail(
  order: Order,
  groupId: string,
  d: { newShipBy: string | null; originalShipBy: string | null; expressConsentNeeded: boolean; cancelBy: string | null },
  cfg: Pick<NotifyConfig, "siteUrl" | "contactEmail">,
) {
  const g = order.fulfillments.find((f) => f.id === groupId);
  const items = order.lineItems.filter((l) => g?.variantIds.includes(l.variantId)).map((l) => `<li>${esc(l.name)} × ${l.quantity}</li>`).join("");
  const when = d.newShipBy ? `We now expect to ship them by <b>${esc(d.newShipBy)}</b>.` : "We can't give you a new shipping date yet.";
  const silence = d.expressConsentNeeded
    ? `<p><b>Please reply to let us know you're happy to wait.</b> Unless you do, we'll cancel these items and refund them in full${d.cancelBy ? ` if they haven't shipped by ${esc(d.cancelBy)}` : ""}.</p>`
    : `<p>If you're happy to wait, you don't need to do anything — if we don't hear from you, we'll take that as agreeing to wait until ${esc(d.newShipBy)}.</p>`;
  return {
    subject: `${prefix(order)}Your FunkSquish order ${order.id} is delayed — your options`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c">
<h2>Sorry — part of your order is running late</h2>
<p>We can't ship these items from order <b>${esc(order.id)}</b> by the date we promised${d.originalShipBy ? ` (${esc(d.originalShipBy)})` : ""}:</p>
<ul>${items}</ul>
<p>${when}</p>
<p><b>You can cancel these items for a full refund</b> at no cost: just reply to this email with "cancel" (or write to ${esc(cfg.contactEmail)}). We'll refund them to your original payment method within 7 business days.</p>
${silence}
<p>You can cancel any time before the items ship. See our <a href="${esc(cfg.siteUrl)}/shipping">Shipping Policy</a>.</p>
</body></html>`,
  };
}
