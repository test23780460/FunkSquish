"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/partners/review/actions";
import { buttonClasses } from "@/components/ui/Button";
import { LockIcon } from "@/components/icons/Icons";

export function ReviewLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="mx-auto max-w-md rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-ice text-royal">
        <LockIcon className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Partner applications</h1>
      <p className="mt-1 text-ink-soft">Owner sign-in.</p>
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
        className="mt-1.5 min-h-12 w-full rounded-2xl bg-ice-50 px-4 text-ink ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal"
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
