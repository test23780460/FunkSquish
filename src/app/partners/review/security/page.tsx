import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { ENROLL_MINUTES, ownerAuth, pendingSecret } from "@/lib/owner/auth";
import { base32Encode, groupKey, otpauthUri } from "@/lib/owner/totp";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SETTINGS_TABS } from "@/components/owner/OwnerNav";
import { DisableMfaForm, EnrollPanel, RegenerateCodesForm } from "@/components/owner/SecurityForms";
import { Callout, OwnerShell, PageTitle, Pill, card, one, panel, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { signOutEverywhereAction, startEnrollmentAction } from "./actions";

export const metadata: Metadata = { title: "Security", robots: { index: false, follow: false } };

export default function SecurityPage({ searchParams }: PageProps<"/partners/review/security">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell narrow>
      <Security searchParams={searchParams} />
    </OwnerShell>
  );
}

const h2 = "font-display text-lg font-bold text-ink sm:text-xl";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

const ACCOUNTS = [
  ["Stripe", "payments, payouts and every customer's payment details — Settings → your profile → Two-step authentication"],
  ["Netlify", "the site, its secrets and stored orders — User settings → Security"],
  ["Google (the business email)", "password resets for everything else — Google Account → Security → 2-Step Verification"],
  ["GitHub", "the site's code and deploys — Settings → Password and authentication"],
  ["Brevo", "customer email addresses and sending — Account → Security"],
  ["TikTok Shop / Seller Center", "orders and buyer addresses — Account settings → Security"],
] as const;

async function Security({ searchParams }: { searchParams: PageProps<"/partners/review/security">["searchParams"] }) {
  await connection();
  const auth = await ownerAuth();
  if (!auth) return <ReviewLogin />;
  if (auth.status === "needs-mfa") redirect("/partners/review/verify");
  const sp = await searchParams;
  const e = auth.enrollment;
  const secret = e ? null : pendingSecret(auth.state, auth.cfg.secret);
  const left = e ? e.recovery.filter((r) => !r.usedAt).length : 0;
  const recovery = one(sp.recovery);

  return (
    <div className="space-y-5">
      {auth.status === "full" && (
        <>
          <OwnerNav current="security" />
          <OwnerSubNav label="Settings pages" items={SETTINGS_TABS} current="/partners/review/security" />
        </>
      )}
      <PageTitle
        title="Security"
        meta={e ? <Pill tone="good">Two-step sign-in on</Pill> : <Pill tone="warn">Two-step sign-in off</Pill>}
        lead="Two-step sign-in for the owner area: your passphrase plus a code from an authenticator app on your phone."
      />

      {auth.status === "needs-enrollment" && (
        <p role="alert" className="flex items-start gap-3 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink ring-1 ring-inset ring-[#f2b9cd]">
          <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#d62f6d] text-[0.7rem] font-black text-white">!</span>
          <span>
          Two-step sign-in is required before you can use the owner area
          {auth.required ? " (customer orders, partner applications, or the “required” setting are switched on)" : ""}. Set it up below. Until it&apos;s
          set up, website checkout and partner applications stay closed.
          </span>
        </p>
      )}
      {recovery !== undefined && (
        <p role="alert" className="rounded-2xl bg-lemon-soft px-4 py-3 font-semibold text-ink ring-1 ring-inset ring-[#f3dd8a]">
          You signed in with a recovery code — {recovery} left. If you lost your phone: turn two-step sign-in off below, set it up on your new phone, and save the new recovery codes.
        </p>
      )}

      {/* Always at this position, so the one-time recovery codes survive the refresh after setup. */}
      <EnrollPanel pending={!e && !!secret}>
        {secret && (
          <>
            <h2 id="setup" className={h2}>Set up two-step sign-in</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink">
              <li>Install an authenticator app on your phone if you don&apos;t have one (Google Authenticator, Microsoft Authenticator, 1Password, Authy or similar).</li>
              <li>
                On your phone, tap{" "}
                <a href={otpauthUri(secret)} className="font-semibold text-royal underline">
                  add FunkSquish to my authenticator app
                </a>
                . Or, in the app, choose &ldquo;Enter a setup key&rdquo; and type:
                <span className="mt-2 block select-all break-all rounded-xl bg-ice-50 px-3 py-2 font-mono text-lg tracking-wider text-ink ring-1 ring-inset ring-sky-200">{groupKey(base32Encode(secret))}</span>
                <span className="block text-sm text-ink-soft">Account: FunkSquish Owner · type: time-based. Don&apos;t screenshot or share this key. It stops working in {ENROLL_MINUTES} minutes if you don&apos;t finish.</span>
              </li>
            </ol>
          </>
        )}
      </EnrollPanel>

      {e ? (
        <section aria-labelledby="on" className={card}>
          <h2 id="on" className={h2}>Two-step sign-in is on</h2>
          <p className="mt-1 text-ink">Since {fmt(e.createdAt)} · recovery codes left: <strong>{left}</strong> of {e.recovery.length}</p>
          {left <= 3 && <Callout tone="warn" className="mt-3">Running low — make new recovery codes.</Callout>}
          <RegenerateCodesForm />
          <form action={signOutEverywhereAction} className="mt-4">
            <button type="submit" className={secondary}>Sign out all devices (including this one)</button>
          </form>
          <details className={cn(panel, "mt-4")}>
            <summary className="cursor-pointer font-semibold text-ink">Turn off two-step sign-in (new phone)</summary>
            <p className="mt-2 text-sm text-ink">
              While it&apos;s off, website checkout and partner applications close (they need two-step sign-in). Set it up again
              straight away on your new phone to reopen them.
            </p>
            <DisableMfaForm />
          </details>
          <p className="mt-4 text-xs text-ink-soft">
            Reset ID: <span className="font-mono">{e.id}</span> — only needed if you lose your phone AND every recovery code (see docs/OWNER-SECURITY.md, &ldquo;Locked out&rdquo;).
          </p>
        </section>
      ) : !secret ? (
        <section aria-labelledby="off" className={cn(card, "ring-2 ring-lemon")}>
          <h2 id="off" className={h2}>Two-step sign-in is off</h2>
          <p className="mt-1 text-ink">
            Right now one passphrase protects customer names, emails and addresses. Turn this on before real orders arrive — after that, signing in also needs a code from your phone, and every owner page and button checks for it. Website checkout and partner applications won&apos;t open until it&apos;s on.
          </p>
          <p className="mt-2 text-sm text-ink-soft">Setting it up signs out every other device. You&apos;ll get ten one-time recovery codes in case you lose your phone.</p>
          <form action={startEnrollmentAction} className="mt-4">
            <button type="submit" className={primary}>Set up two-step sign-in</button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="others" className={card}>
        <h2 id="others" className={h2}>Also turn on two-step sign-in for these accounts</h2>
        <p className="mt-1 text-sm text-ink-soft">Recommended. This site can&apos;t change them for you — each one is set in that service&apos;s own settings (menu names may differ slightly).</p>
        <ul className="mt-3 grid gap-2 text-sm text-ink">
          {ACCOUNTS.map(([name, why]) => (
            <li key={name} className={cn(panel, "px-3.5 py-3")}>
              <strong className="block font-display text-base">{name}</strong>
              <span className="text-ink-soft">{why}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
