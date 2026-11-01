import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { ownerMfaReady } from "@/lib/owner/mfa-gate";
import { features } from "@/lib/features";
import { siteConfig } from "@/lib/site";
import { dropAlertsActive, newsletterActive } from "@/lib/integrations/status";
import { brevoConfigured, dropAlertsConfigured } from "@/lib/newsletter/brevo";
import { SIGNUP_LIMITS } from "@/lib/newsletter/limits";
import { freshReleaseProducts } from "@/commerce/catalog-release";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { loadStockRows } from "@/commerce/orders/stock-admin";
import { campaignBlockers, campaignHtml, listCampaigns } from "@/commerce/marketing/campaigns";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Select, Text, Area } from "@/components/owner/Fields";
import { Empty, Flash, OwnerShell, PageTitle, Pill, card, dateTime, input, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import { createCampaignAction, deleteCampaignAction, sendCampaignAction } from "./actions";

export const metadata: Metadata = { title: "Email & marketing", robots: { index: false, follow: false } };

/** PRIVATE: the two email lists, their safeguards, and drop/restock alert drafts (sending is switched off). */
export default function MarketingPage({ searchParams }: PageProps<"/partners/review/marketing">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Marketing searchParams={searchParams} />
    </OwnerShell>
  );
}

async function Marketing({ searchParams }: { searchParams: PageProps<"/partners/review/marketing">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const [campaigns, live, mfa] = await Promise.all([listCampaigns(data), freshReleaseProducts().catch(() => null), ownerMfaReady()]);
  const products = live ?? [];
  const inv = await inventoryContext();
  const rows = await loadStockRows(inv.store, inv.items, { now: new Date() });
  const gate = { alertsActive: dropAlertsActive(), sendingApproved: process.env.DROP_ALERTS_SENDING === "on", production: process.env.BUILD_CONTEXT === "production", mfaReady: mfa.ready };
  const address = siteConfig.mailingAddress.slice(1).join(", ");

  const lists = [
    {
      name: "Launch list (newsletter)",
      code: features.newsletter,
      connected: brevoConfigured(),
      active: newsletterActive(),
      env: "BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID; switch: features.newsletter or NEWSLETTER_ENABLED",
      template: "templates/email/brevo-double-opt-in.html",
    },
    {
      name: "Drop & restock alerts",
      code: features.dropAlerts,
      connected: dropAlertsConfigured(),
      active: dropAlertsActive(),
      env: "BREVO_DROPS_LIST_ID, BREVO_DROPS_DOI_TEMPLATE_ID; switch: features.dropAlerts or DROP_ALERTS_ENABLED; sending also needs DROP_ALERTS_SENDING=on and BREVO_DROPS_SENDER",
      template: "templates/email/brevo-drop-alerts-double-opt-in.html",
    },
  ];

  return (
    <div>
      <OwnerNav current="marketing" />
      <PageTitle title="Email & marketing" lead="Two separate lists, both double opt-in through Brevo: nobody is added until they tap the confirmation link. This site never stores email addresses. Order emails (receipts, shipping) are separate and never marketing." />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid gap-5 lg:grid-cols-2">
        {lists.map((l) => (
          <section key={l.name} className={card} aria-label={l.name}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{l.name}</h2>
              <Pill tone={l.active ? "good" : l.connected ? "warn" : "plain"}>{l.active ? "Sign-ups open" : l.connected ? "Connected, off" : "Not connected here"}</Pill>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              <li>Code switch: {l.code ? "on" : "off"} (changes only through an approved launch PR)</li>
              <li>Consent: an unticked box the visitor must tick, then Brevo&apos;s confirmation email (template: <span className="font-mono text-xs">{l.template}</span>)</li>
              <li>Unsubscribe: every Brevo email has a one-click unsubscribe link; Brevo honors it automatically</li>
              <li>Spam protection: hidden honeypot field, and at most {SIGNUP_LIMITS.perNetworkPerHour} sign-ups per network per hour ({SIGNUP_LIMITS.perNetworkPerDay} a day) and {SIGNUP_LIMITS.totalPerHour} in total per hour</li>
              <li className="text-ink-soft">Needs: {l.env}</li>
            </ul>
          </section>
        ))}
      </div>

      <section id="campaigns" className={cn(card, "mt-5 scroll-mt-28")} aria-labelledby="c">
        <h2 id="c" className="font-display text-lg font-bold text-ink sm:text-xl">Drop &amp; restock alerts</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Draft alerts for real products. An alert can only be sent when it&apos;s true (the product is on the website; for a restock, it&apos;s back in stock and buyable), drop alerts are switched on, sending is approved for Production, and two-step sign-in is set up. The same alert for the same products goes out at most once a day.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          <li><Pill tone={gate.alertsActive ? "good" : "plain"}>alerts {gate.alertsActive ? "on" : "off"}</Pill></li>
          <li><Pill tone={gate.sendingApproved ? "good" : "plain"}>sending {gate.sendingApproved ? "approved" : "not approved"}</Pill></li>
          <li><Pill tone={gate.production ? "good" : "plain"}>{gate.production ? "production" : "not production"}</Pill></li>
          <li><Pill tone={gate.mfaReady ? "good" : "plain"}>two-step {gate.mfaReady ? "on" : "off"}</Pill></li>
        </ul>

        {campaigns.length === 0 ? (
          <div className="mt-3">
            <Empty>No alert drafts yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4">
            {campaigns.map((c) => {
              const blockers = campaignBlockers(c, products, (v) => rows.find((r) => r.variantId === v)?.free ?? null, gate);
              return (
                <li key={c.id} className="rounded-2xl bg-ice-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-lg font-bold text-ink">
                      {c.subject} <Pill>{c.kind}</Pill> <Pill tone={c.status === "sent" ? "good" : c.status === "failed" ? "alert" : "plain"}>{c.status}</Pill>
                    </p>
                    <span className="text-xs text-ink-soft">{c.sentAt ? `sent ${dateTime(c.sentAt)}` : `drafted ${dateTime(c.createdAt)}`}</span>
                  </div>
                  {c.error && <p className="mt-1 text-sm font-semibold text-[#a3174f]">{c.error}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-royal">Preview the email</summary>
                    <iframe title={`Preview: ${c.subject}`} srcDoc={campaignHtml(c, products, { url: siteConfig.url, mailingAddress: address })} sandbox="" className="mt-2 h-96 w-full rounded-2xl bg-white ring-1 ring-inset ring-sky-200" />
                  </details>
                  {blockers.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-sm text-ink">
                      {blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    c.status !== "sent" && (
                      <form action={sendCampaignAction} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <label className={label}>
                          Type SEND to email everyone on the drops list
                          <input name="confirm" autoComplete="off" className={input} />
                        </label>
                        <button className={primary}>{c.status === "failed" ? "Retry send" : "Send"}</button>
                      </form>
                    )
                  )}
                  {c.status === "draft" && (
                    <form action={deleteCampaignAction} className="mt-2">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-sm font-semibold text-[#a3174f] underline">Delete draft</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form action={createCampaignAction} className="mt-5 grid gap-3 rounded-2xl p-3 ring-2 ring-dashed ring-sky-200 sm:grid-cols-2">
          <h3 className="font-display text-lg font-bold text-ink sm:col-span-2">New alert draft</h3>
          <Select name="kind" title="Kind" value="drop" options={[{ value: "drop", label: "New drop" }, { value: "restock", label: "Back in stock" }]} />
          <Text name="subject" title="Subject" required maxLength={120} placeholder="New jelly squishies just dropped" />
          <Area name="intro" title="Short intro (optional)" maxLength={1000} className="sm:col-span-2" />
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold text-ink">Products (1–6, from the published catalog)</legend>
            {products.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Nothing is published yet, so there&apos;s nothing real to announce.</p>
            ) : (
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="product" value={p.id} className="size-5" /> {p.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="sm:col-span-2">
            <button className={secondary} disabled={products.length === 0}>
              Save draft
            </button>
          </div>
        </form>
      </section>

      <section className={cn(card, "mt-5")} aria-labelledby="int">
        <h2 id="int" className="font-display text-lg font-bold text-ink sm:text-xl">Product-specific &ldquo;tell me when&rdquo; alerts</h2>
        <p className="mt-1 text-sm text-ink">
          Not built on purpose. Remembering which product each person wants means storing their interest with their email, which needs its own consent wording in the Privacy Policy. Today the drops list covers everything; if you want per-product alerts later, it&apos;s a reviewed change together with that wording.
        </p>
      </section>
    </div>
  );
}
