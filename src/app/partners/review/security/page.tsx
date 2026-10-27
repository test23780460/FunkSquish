import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { ENROLL_MINUTES, ownerAuth, pendingSecret } from "@/lib/owner/auth";
import { base32Encode, groupKey, otpauthUri } from "@/lib/owner/totp";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { DisableMfaForm, EnrollPanel, RegenerateCodesForm } from "@/components/owner/SecurityForms";
import { buttonClasses } from "@/components/ui/Button";
import { signOutEverywhereAction, startEnrollmentAction } from "./actions";

export const metadata: Metadata = { title: "Security", robots: { index: false, follow: false } };

export default function SecurityPage({ searchParams }: PageProps<"/partners/review/security">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-2xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Security searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const card = "rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200 sm:p-6";
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
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const e = auth.enrollment;
  const secret = e ? null : pendingSecret(auth.state, auth.cfg.secret);
  const left = e ? e.recovery.filter((r) => !r.usedAt).length : 0;
  const recovery = one(sp.recovery);

  return (
    <div className="space-y-5">
      {auth.status === "full" && <OwnerNav current="security" />}
      <div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Security</h1>
        <p className="text-ink-soft">Two-step sign-in for the owner area: your passphrase plus a code from an authenticator app on your phone.</p>
      </div>

      {auth.status === "needs-enrollment" && (
        <p role="alert" className="rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">
          Two-step sign-in is required before you can use the owner area{auth.required ? " (customer orders are live, or it's been switched on as required)" : ""}. Set it up below.
        </p>
      )}
      {recovery !== undefined && (
        <p role="alert" className="rounded-2xl bg-lemon-soft px-4 py-3 font-semibold text-ink">
          You signed in with a recovery code — {recovery} left. If you lost your phone: turn two-step sign-in off below, set it up on your new phone, and save the new recovery codes.
        </p>
      )}

      {/* Always at this position, so the one-time recovery codes survive the refresh after setup. */}
      <EnrollPanel pending={!e && !!secret}>
        {secret && (
          <>
            <h2 id="setup" className="font-display text-xl font-bold text-ink">Set up two-step sign-in</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink">
              <li>Install an authenticator app on your phone if you don&apos;t have one (Google Authenticator, Microsoft Authenticator, 1Password, Authy or similar).</li>
              <li>
                On your phone, tap{" "}
                <a href={otpauthUri(secret)} className="font-semibold text-royal underline">
                  add FunkSquish to my authenticator app
                </a>
                . Or, in the app, choose &ldquo;Enter a setup key&rdquo; and type:
                <span className="mt-2 block select-all break-all rounded-xl bg-ice-50 px-3 py-2 font-mono text-lg tracking-wider text-ink">{groupKey(base32Encode(secret))}</span>
                <span className="block text-sm text-ink-soft">Account: FunkSquish Owner · type: time-based. Don&apos;t screenshot or share this key. It stops working in {ENROLL_MINUTES} minutes if you don&apos;t finish.</span>
              </li>
            </ol>
          </>
        )}
      </EnrollPanel>

      {e ? (
        <section aria-labelledby="on" className={card}>
          <h2 id="on" className="font-display text-xl font-bold text-ink">Two-step sign-in is on</h2>
          <p className="mt-1 text-ink">Since {fmt(e.createdAt)} · recovery codes left: <strong>{left}</strong> of {e.recovery.length}</p>
          {left <= 3 && <p className="mt-2 rounded-xl bg-lemon-soft px-3 py-2 text-sm font-semibold text-ink">Running low — make new recovery codes.</p>}
          <RegenerateCodesForm />
          <form action={signOutEverywhereAction} className="mt-4">
            <button type="submit" className="min-h-12 rounded-full bg-white px-5 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">Sign out all devices (including this one)</button>
          </form>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold text-royal">Turn off two-step sign-in (new phone)</summary>
            <DisableMfaForm />
          </details>
          <p className="mt-4 text-xs text-ink-soft">
            Reset ID: <span className="font-mono">{e.id}</span> — only needed if you lose your phone AND every recovery code (see docs/OWNER-SECURITY.md, &ldquo;Locked out&rdquo;).
          </p>
        </section>
      ) : !secret ? (
        <section aria-labelledby="off" className={card}>
          <h2 id="off" className="font-display text-xl font-bold text-ink">Two-step sign-in is off</h2>
          <p className="mt-1 text-ink">
            Right now one passphrase protects customer names, emails and addresses. Turn this on before real orders arrive — after that, signing in also needs a code from your phone, and every owner page and button checks for it.
          </p>
          <p className="mt-2 text-sm text-ink-soft">Setting it up signs out every other device. You&apos;ll get ten one-time recovery codes in case you lose your phone.</p>
          <form action={startEnrollmentAction} className="mt-4">
            <button type="submit" className={buttonClasses({})}>Set up two-step sign-in</button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="others" className={card}>
        <h2 id="others" className="font-display text-xl font-bold text-ink">Also turn on two-step sign-in for these accounts</h2>
        <p className="mt-1 text-sm text-ink-soft">Recommended. This site can&apos;t change them for you — each one is set in that service&apos;s own settings (menu names may differ slightly).</p>
        <ul className="mt-3 space-y-2 text-ink">
          {ACCOUNTS.map(([name, why]) => (
            <li key={name} className="rounded-xl bg-ice-50 px-3 py-2">
              <strong>{name}</strong> — {why}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
