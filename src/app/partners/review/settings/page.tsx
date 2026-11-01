import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerAuth } from "@/lib/owner/auth";
import { ownerDataStore } from "@/lib/owner/data";
import { environmentName, lastBackup } from "@/lib/owner/backup";
import { features } from "@/lib/features";
import { analyticsActive, dropAlertsActive, newsletterActive, partnerApplicationsActive } from "@/lib/integrations/status";
import { brevoConfigured, dropAlertsConfigured } from "@/lib/newsletter/brevo";
import { readStripeLiveConfig, runtimeEnv, testCheckoutEnabled } from "@/commerce/checkout/environment";
import { liveCodeSwitchOn } from "@/commerce/checkout/live";
import { activeMode } from "@/commerce/checkout/service";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SETTINGS_TABS } from "@/components/owner/OwnerNav";
import { Flash, OwnerShell, PageTitle, Pill, card, dateTime, input, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { pruneAuditAction, restoreBackupAction } from "./actions";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

/**
 * PRIVATE: what's switched on, what's connected, backups. Read-only for
 * launch switches — those change only through a reviewed launch PR
 * (scripts/safeguards-check.mjs), never from a button.
 */
export default function SettingsPage({ searchParams }: PageProps<"/partners/review/settings">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Settings searchParams={searchParams} />
    </OwnerShell>
  );
}

const LIVE_PROBLEM: Record<string, string> = {
  "code-switch-off": "Off in code (src/lib/features.ts) — changes only through an approved launch PR.",
  "environment-not-allowed": "Only production can take real payments.",
  "switch-off": "STRIPE_LIVE_CHECKOUT_ENABLED isn't set for Production.",
  "missing-secret-key": "No live Stripe key set (you create it in Stripe; never paste it in chat or GitHub).",
  "test-key-rejected": "A test key was set where the live key belongs.",
  "invalid-secret-key": "The live key setting isn't a Stripe live key.",
  "missing-webhook-secret": "No live webhook signing secret set.",
  "shipping-not-verified": "No shipping origin has verified rates yet.",
  "shipping-not-approved": "The shipping table hasn't been approved (Shipping page).",
};

async function Settings({ searchParams }: { searchParams: PageProps<"/partners/review/settings">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const auth = await ownerAuth();
  const data = await ownerDataStore(ctx.cfg);
  const backupAt = await lastBackup(data).catch(() => null);
  const env = environmentName(ctx.cfg);
  const mode = activeMode();
  const live = readStripeLiveConfig(runtimeEnv(), liveCodeSwitchOn());

  const switches: { name: string; on: boolean; what: string }[] = [
    { name: "Purchasing (commerce)", on: features.commerce, what: "Master switch for any buying on the website." },
    { name: `Checkout mode: ${features.checkoutMode}`, on: features.checkoutMode !== "disabled", what: "How shoppers would pay once purchasing is on." },
    { name: "Launch email sign-up", on: features.newsletter, what: "Public newsletter form (double opt-in through Brevo)." },
    { name: "Drop & restock alerts", on: features.dropAlerts, what: "Public alert sign-up (separate Brevo list)." },
    { name: "Partner applications", on: features.partnerApplications, what: "Public partner/supplier application form." },
  ];
  const integrations: { name: string; state: "active" | "configured" | "off"; detail: string }[] = [
    { name: "Stripe checkout", state: mode ? "active" : "off", detail: mode === "live" ? "LIVE — real payments." : mode === "test" ? "Sandbox test mode (no real money)." : "Not open here." },
    { name: "Stripe live readiness", state: live.ok ? "active" : "off", detail: live.ok ? "Every live lock is open." : LIVE_PROBLEM[live.problem] ?? live.problem },
    { name: "Brevo launch list", state: newsletterActive() ? "active" : brevoConfigured() ? "configured" : "off", detail: newsletterActive() ? "Sign-ups are open." : brevoConfigured() ? "Connected here, sign-ups switched off." : "Not connected here." },
    { name: "Brevo drops list", state: dropAlertsActive() ? "active" : dropAlertsConfigured() ? "configured" : "off", detail: dropAlertsConfigured() ? "Separate list connected." : "Separate list not connected here." },
    { name: "Partner applications", state: partnerApplicationsActive() ? "active" : "off", detail: partnerApplicationsActive() ? "Public form open." : "Public form closed." },
    { name: "Umami analytics", state: analyticsActive() ? "active" : "off", detail: analyticsActive() ? "Counting visits on this site (no personal data)." : "Only runs on the production site." },
    { name: "Test checkout switch", state: testCheckoutEnabled() ? "active" : "off", detail: "Previews and local development only; never production." },
  ];

  return (
    <div>
      <OwnerNav current="settings" />
      <OwnerSubNav label="Settings pages" items={SETTINGS_TABS} current="/partners/review/settings" />
      <PageTitle title="Settings" lead="What's switched on here, what's connected, and your backups. Secret values are never shown." />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="env" className={card}>
          <h2 id="env" className="font-display text-xl font-bold text-ink">This site</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-ink">
            <dt className="font-semibold">Environment</dt>
            <dd>{env === "production" ? "Production (funksquish.com)" : env === "preview" ? "Deploy preview — test data only" : "Local development — data disappears on restart"}</dd>
            <dt className="font-semibold">Dashboard storage</dt>
            <dd>{ctx.cfg.storage === "memory" ? "In memory (not durable)" : `Netlify Blobs, private${ctx.cfg.storeSuffix ? " (preview stores)" : ""}`}</dd>
            <dt className="font-semibold">Two-step sign-in</dt>
            <dd>{auth?.enrollment ? `On since ${auth.enrollment.createdAt.slice(0, 10)}` : auth?.required ? "Required — set it up now" : "Not set up (optional until launch)"}</dd>
          </dl>
          <Link href="/partners/review/security" className={cn(secondary, "mt-3")}>
            Security settings
          </Link>
        </section>

        <section aria-labelledby="switches" className={card}>
          <h2 id="switches" className="font-display text-xl font-bold text-ink">Launch switches</h2>
          <p className="mt-1 text-sm text-ink-soft">These are set in code and checked on every pull request, so nothing can switch on by accident. Turning one on is a launch PR you approve.</p>
          <ul className="mt-3 space-y-2">
            {switches.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <strong className="text-ink">{s.name}</strong>
                  <span className="block text-ink-soft">{s.what}</span>
                </span>
                <Pill tone={s.on ? "alert" : "plain"}>{s.on ? "On" : "Off"}</Pill>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="int" className={cn(card, "lg:col-span-2")}>
          <h2 id="int" className="font-display text-xl font-bold text-ink">Integrations</h2>
          <ul className="mt-2 divide-y divide-sky-100">
            {integrations.map((i) => (
              <li key={i.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong className="text-ink">{i.name}</strong> <span className="text-ink-soft">— {i.detail}</span>
                </span>
                <Pill tone={i.state === "active" ? "good" : i.state === "configured" ? "warn" : "plain"}>{i.state === "active" ? "Active" : i.state === "configured" ? "Connected, off" : "Off"}</Pill>
              </li>
            ))}
          </ul>
        </section>

        <section id="backup" aria-labelledby="bk" className={cn(card, "lg:col-span-2")}>
          <h2 id="bk" className="font-display text-xl font-bold text-ink">Backups</h2>
          <p className="mt-1 text-sm text-ink">
            Last download: <strong>{backupAt ? dateTime(backupAt) : "never"}</strong>. The backup holds products, private costs, suppliers, shipping set-up, catalog releases and the activity log —
            keep it somewhere private (not GitHub, not email). Orders and stock have their own exports on the Orders and Inventory pages.
          </p>
          <a href="/partners/review/settings/backup" className={cn(primary, "mt-3")} download>
            Download backup (.json)
          </a>
          <form action={restoreBackupAction} className="mt-5 grid gap-3 rounded-2xl bg-ice-50 p-4 sm:max-w-xl">
            <p className="font-display font-semibold text-ink">Restore from a backup</p>
            <p className="text-sm text-ink-soft">Adds anything missing. It only replaces records that changed if you tick the box and type RESTORE. It never deletes. Press &ldquo;Check only&rdquo; first to see what would change.</p>
            <label className={label}>
              Backup file
              <input name="file" type="file" accept="application/json,.json" required className="text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input name="overwrite" type="checkbox" value="yes" className="size-5" /> Also replace records that are different now
            </label>
            <label className={label}>
              Type RESTORE to write changes
              <input name="confirm" className={input} autoComplete="off" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="check" className={secondary}>Check only</button>
              <button name="intent" value="restore" className={primary}>Restore</button>
            </div>
          </form>
        </section>

        <section aria-labelledby="prev" className={card}>
          <h2 id="prev" className="font-display text-xl font-bold text-ink">Deploy preview protection</h2>
          <p className="mt-1 text-sm text-ink">
            Previews hold test data and the test owner login, so only your Netlify team should open them. If it&apos;s off (it was turned off for webhook testing), turn it back on in Netlify:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>Netlify → the FunkSquish project → Project configuration → Access &amp; security → Visitor access.</li>
            <li>Under Password / SSO protection, choose Configure.</li>
            <li>Pick &ldquo;Netlify Team Login&rdquo; and apply it to <strong>non-production deploys only</strong>, then Save.</li>
          </ol>
          <p className="mt-2 text-sm text-ink-soft">Leave the production site public. This is an account setting, so the dashboard can&apos;t (and shouldn&apos;t) change it for you.</p>
        </section>

        <section aria-labelledby="ret" className={card}>
          <h2 id="ret" className="font-display text-xl font-bold text-ink">Activity log retention</h2>
          <p className="mt-1 text-sm text-ink">The activity log keeps two years of owner actions (ids and short descriptions only — no customer details). Older entries can be removed here.</p>
          <form action={pruneAuditAction} className="mt-3">
            <button className={secondary}>Remove entries older than 2 years</button>
          </form>
        </section>
      </div>
    </div>
  );
}
