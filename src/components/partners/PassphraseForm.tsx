"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/partners/review/actions";
import { buttonClasses } from "@/components/ui/Button";
import { LockIcon } from "@/components/icons/Icons";

/** Step 1 of owner sign-in (client form). Pages render <ReviewLogin />, which decides whether to show this. */
export function PassphraseForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_12px_32px_-20px_rgba(19,53,122,0.28)] ring-1 ring-sky-100 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-ice text-royal">
        <LockIcon className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Owner area</h1>
      <p className="mt-1 text-ink-soft">Owner sign-in. If two-step sign-in is on, you&apos;ll be asked for a code next.</p>
      <label htmlFor="passphrase" className="mt-6 block font-display font-semibold text-ink">
        Passphrase
      </label>
      <input
        id="passphrase"
        name="passphrase"
        type="password"
        required
        autoComplete="current-password"
        maxLength={200}
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "login-error" : undefined}
        className="mt-1.5 min-h-12 w-full rounded-xl bg-white px-4 text-ink shadow-[inset_0_1px_2px_rgba(19,53,122,0.06)] ring-1 ring-inset ring-sky-200 focus:outline-none focus:ring-2 focus:ring-royal"
      />
      {state.error && (
        <p id="login-error" role="alert" className="mt-3 rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClasses({ className: "mt-5 w-full disabled:opacity-60" })}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
