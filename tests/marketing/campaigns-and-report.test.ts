import { describe, expect, it, vi } from "vitest";
import { MemoryKvStore } from "@/lib/storage/kv-core";
import { campaignBlockers, campaignHtml, campaignKey, contentProblems, newCampaign, sendCampaign, type Campaign } from "@/commerce/marketing/campaigns";
import { salesReport, salesCsvRows } from "@/commerce/analytics/report";
import { toPublicProduct } from "@/commerce/catalog-admin/record";
import { completeRecord } from "../products/fixtures";
import { order } from "../owner/factory";

/* Fictional products, a fake Brevo — nothing is sent anywhere. */
const PRODUCT = toPublicProduct({ ...completeRecord(), status: "published" });
const product = () => PRODUCT;
const OPEN = { alertsActive: true, sendingApproved: true, production: true, mfaReady: true };
const SITE = { url: "https://example.com", mailingAddress: "1 Example St, Testville" };

function campaign(kind: "drop" | "restock" = "drop"): Campaign {
  const c = newCampaign(kind, "New <b>jelly</b> squishies", "Hello & welcome", [product().id], new Date("2026-11-02T10:00:00Z"));
  if (typeof c === "string") throw new Error(c);
  return c;
}

describe("drop & restock alerts: only when true and approved", () => {
  it("everything is blocked today: switches off, nothing published", () => {
    const b = campaignBlockers(campaign(), [], () => null, { alertsActive: false, sendingApproved: false, production: false, mfaReady: false });
    expect(b.join(" ")).toMatch(/isn't on the website[\s\S]*switched on[\s\S]*approved[\s\S]*preview[\s\S]*two-step/);
  });

  it("a restock alert needs the item really back in stock and buyable (purchasing is off today, so never)", () => {
    const p = product();
    const blockers = campaignBlockers(campaign("restock"), [p], () => 5, OPEN);
    expect(blockers.join(" ")).toMatch(/isn't back in stock and buyable/);
  });

  it("a drop alert for a published product with every gate open has no blockers", () => {
    expect(campaignBlockers(campaign("drop"), [product()], () => 0, OPEN)).toEqual([]);
  });

  it("the email has the unsubscribe link and mailing address, and escapes text", () => {
    const html = campaignHtml(campaign(), [product()], SITE);
    expect(contentProblems(html)).toEqual([]);
    expect(html).toContain("{{ unsubscribe }}");
    expect(html).toContain("1 Example St, Testville");
    expect(html).not.toContain("<b>jelly</b>");
    expect(html).toContain("Hello &amp; welcome");
    expect(contentProblems("<p>no footer</p>")).toHaveLength(2);
  });
});

describe("sending: once, with recovery", () => {
  function brevo(failSend = 0) {
    let created = 0;
    let sends = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/emailCampaigns")) {
        created++;
        return new Response(JSON.stringify({ id: 42 }), { status: 201 });
      }
      sends++;
      return new Response(null, { status: sends <= failSend ? 500 : 204 });
    }) as unknown as typeof globalThis.fetch;
    return { fetch, stats: () => ({ created, sends }) };
  }
  const deps = (f: typeof fetch) => ({ fetch: f, apiKey: "test-not-real", listId: 7, sender: { name: "FunkSquish", email: "hello@example.com" } });

  it("sends a campaign exactly once, even if pressed twice at the same moment", async () => {
    const s = new MemoryKvStore();
    const c = campaign();
    await s.create(campaignKey(c.id), c);
    const b = brevo();
    const html = campaignHtml(c, [product()], SITE);
    const [x, y] = await Promise.all([sendCampaign(s, c.id, html, deps(b.fetch)), sendCampaign(s, c.id, html, deps(b.fetch))]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
    expect(b.stats()).toEqual({ created: 1, sends: 1 });
    expect((await sendCampaign(s, c.id, html, deps(b.fetch))).ok).toBe(false);
  });

  it("if Brevo's send step fails, a retry reuses the same Brevo campaign", async () => {
    const s = new MemoryKvStore();
    const c = campaign();
    await s.create(campaignKey(c.id), c);
    const b = brevo(1);
    const html = campaignHtml(c, [product()], SITE);
    const first = await sendCampaign(s, c.id, html, deps(b.fetch));
    expect(first).toMatchObject({ ok: false, campaign: { status: "failed", brevoCampaignId: 42 } });
    const retry = await sendCampaign(s, c.id, html, deps(b.fetch));
    expect(retry.ok).toBe(true);
    expect(b.stats()).toEqual({ created: 1, sends: 2 });
  });

  it("the same alert for the same products can't go out twice on one day from two campaigns", async () => {
    const s = new MemoryKvStore();
    const a = campaign();
    const b2 = { ...campaign(), id: "c_bbbbbbbbbbbb" };
    await s.create(campaignKey(a.id), a);
    await s.create(campaignKey(b2.id), b2);
    const b = brevo();
    const html = campaignHtml(a, [product()], SITE);
    expect((await sendCampaign(s, a.id, html, deps(b.fetch), new Date("2026-11-02T10:00:00Z"))).ok).toBe(true);
    expect(await sendCampaign(s, b2.id, html, deps(b.fetch), new Date("2026-11-02T18:00:00Z"))).toMatchObject({ ok: false, error: expect.stringMatching(/already went out today/) });
    expect(b.stats().created).toBe(1);
  });

  it("refuses an email without unsubscribe or address", async () => {
    const s = new MemoryKvStore();
    const c = campaign();
    await s.create(campaignKey(c.id), c);
    expect((await sendCampaign(s, c.id, "<p>hi</p>", deps(brevo().fetch))).ok).toBe(false);
  });
});

describe("sales report: facts from orders, estimates labeled", () => {
  const range = { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") };

  it("no orders: zeros, no estimate", () => {
    const r = salesReport([], [], range);
    expect(r.facts.orders).toBe(0);
    expect(r.estimates.grossProfitBeforeShipping).toBeNull();
  });

  it("counts paid orders and refunds; costs only from your entries, flagged when missing", () => {
    const rec = completeRecord();
    const vid = rec.product.variants[0].id;
    const o1 = order({ id: "FS-T-1", refunds: [{ stripeRefundId: "re_1", amount: 500, reason: null, createdAt: "2026-11-05T00:00:00Z" }] });
    o1.lineItems[0] = { ...o1.lineItems[0], variantId: vid, productId: rec.id, quantity: 2, amountTotal: 2000 };
    const o2 = order({ id: "FS-T-2" }); // a variant with no cost entered
    const unpaid = order({ id: "FS-T-3", paymentStatus: "failed", status: "awaiting_payment" });
    const r = salesReport([o1, o2, unpaid], [rec], range);
    expect(r.facts).toMatchObject({ orders: 2, unitsSold: 3, gross: 5000, refunded: 500, netRevenue: 4500 });
    expect(r.estimates).toMatchObject({ productCost: 600, unitsWithoutCost: 1, complete: false });
    expect(r.estimates.grossProfitBeforeShipping).toBe(4500 - 1000 - 600);
    expect(r.products[0]).toMatchObject({ sku: o1.lineItems[0].sku, units: 2 });
  });

  it("the sales spreadsheet has no customer details", () => {
    const csv = JSON.stringify(salesCsvRows([order()]));
    expect(csv).not.toMatch(/fictional\.buyer|Fictional Buyer|Example Way|Testville/);
  });
});
