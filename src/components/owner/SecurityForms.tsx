"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import {
  confirmEnrollmentAction,
  disableMfaAction,
  regenerateCodesAction,
  verifyMfaAction,
  type CodeState,
  type CodesState,
} from "@/app/partners/review/security/actions";
import { buttonClasses } from "@/components/ui/Button";
import { LockIcon } from "@/components/icons/Icons";

const field =
  "mt-1.5 min-h-12 w-full rounded-xl bg-white px-4 text-xl tracking-[0.2em] text-ink shadow-[inset_0_1px_2px_rgba(19,53,122,0.06)] ring-1 ring-inset ring-sky-200 focus:outline-none focus:ring-2 focus:ring-royal";

function Alert({ text, id }: { text: string | null; id: string }) {
  return text ? (
    <p id={id} role="alert" className="mt-3 rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink">
      {text}
    </p>
  ) : null;
}

/** Step 2 of sign-in. */
export function MfaVerifyForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyMfaAction, { error: null });
  return (
    <form action={action} className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_12px_32px_-20px_rgba(19,53,122,0.28)] ring-1 ring-sky-100 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-ice text-royal">
        <LockIcon className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Enter your code</h1>
      <p className="mt-1 text-ink-soft">Open your authenticator app and type the 6-digit code for FunkSquish.</p>
      <label htmlFor="code" className="mt-6 block font-display font-semibold text-ink">
        Code
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={40}
        autoFocus
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "code-error" : "code-help"}
        className={field}
      />
      <p id="code-help" className="mt-2 text-sm text-ink-soft">
        Lost your phone? Type one of your recovery codes instead (like K7QX2-MNP4R). Each works once.
      </p>
      <Alert text={state.error} id="code-error" />
      <button type="submit" disabled={pending} className={buttonClasses({ className: "mt-5 w-full disabled:opacity-60" })}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="mt-4 rounded-2xl bg-lemon-soft p-4 ring-1 ring-inset ring-[#f3dd8a]">
      <p className="font-display font-bold text-ink">Save these recovery codes now — they won&apos;t be shown again.</p>
      <p className="mt-1 text-sm text-ink">Each one signs you in once if you lose your phone. Keep them somewhere safe that isn&apos;t this phone (a password manager, or printed and put away). Never send them in a message.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-base text-ink sm:text-lg" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c} className="whitespace-nowrap rounded-xl bg-white px-2 py-2 text-center">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Setup panel: the instructions (from the server) plus the first-code form,
 * and afterwards the recovery codes — shown once. Turning two-step sign-in on
 * refreshes the page (new session cookie), so the page renders this panel at
 * the same place whether or not setup is pending; that keeps the codes on
 * screen instead of losing them in the refresh.
 */
export function EnrollPanel({ pending, children }: { pending: boolean; children?: ReactNode }) {
  const [state, action, busy] = useActionState<CodesState, FormData>(confirmEnrollmentAction, { error: null, codes: null });
  if (state.codes)
    return (
      <section aria-labelledby="codes-title" className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_12px_32px_-20px_rgba(19,53,122,0.28)] ring-2 ring-mint sm:p-6">
        <h2 id="codes-title" className="sr-only">Recovery codes</h2>
        <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">
          Two-step sign-in is on. Every other device has been signed out.
        </p>
        <RecoveryCodes codes={state.codes} />
        <Link href="/partners/review/today" className={buttonClasses({ className: "mt-5" })}>
          I&apos;ve saved them — continue
        </Link>
      </section>
    );
  if (!pending) return null;
  return (
    <section aria-labelledby="setup" className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_12px_32px_-20px_rgba(19,53,122,0.28)] ring-1 ring-sky-100 sm:p-6">
      {children}
      <form action={action} className="mt-4">
        <label htmlFor="enroll-code" className="block font-display font-semibold text-ink">
          Then type the 6-digit code the app shows
        </label>
        <input id="enroll-code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} aria-describedby={state.error ? "enroll-error" : undefined} className={field} />
        <Alert text={state.error} id="enroll-error" />
        <button type="submit" disabled={busy} className={buttonClasses({ className: "mt-4 disabled:opacity-60" })}>
          {busy ? "Checking…" : "Turn on two-step sign-in"}
        </button>
      </form>
    </section>
  );
}

export function RegenerateCodesForm() {
  const [state, action, pending] = useActionState<CodesState, FormData>(regenerateCodesAction, { error: null, codes: null });
  if (state.codes) return <RecoveryCodes codes={state.codes} />;
  return (
    <form action={action} className="mt-3">
      <label htmlFor="regen-code" className="block text-sm font-semibold text-ink">
        Code from your app
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="regen-code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} className={`${field} w-40`} />
        <button type="submit" disabled={pending} className="mt-1.5 min-h-12 rounded-full bg-white px-5 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
          Make new recovery codes
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">The old codes stop working.</p>
      <Alert text={state.error} id="regen-error" />
    </form>
  );
}

export function DisableMfaForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(disableMfaAction, { error: null });
  return (
    <form action={action} className="mt-3 grid gap-2">
      <label className="text-sm font-semibold text-ink">
        Code from your app (or a recovery code)
        <input name="code" required autoComplete="one-time-code" maxLength={40} className={field} />
      </label>
      <label className="text-sm font-semibold text-ink">
        Type TURN OFF
        <input name="confirm" required autoComplete="off" className={`${field} tracking-normal`} />
      </label>
      <Alert text={state.error} id="disable-error" />
      <button type="submit" disabled={pending} className="justify-self-start rounded-full bg-white px-5 py-3 font-display font-semibold text-[#a3174f] ring-2 ring-inset ring-[#a3174f]">
        Turn off and sign out everywhere
      </button>
    </form>
  );
}
