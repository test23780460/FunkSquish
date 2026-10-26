"use client";

import { useActionState, useEffect, useId } from "react";
import Link from "next/link";
import { subscribeToDropAlertsAction, type DropAlertState } from "@/app/actions/drop-alerts";
import { siteConfig } from "@/lib/site";
import { trackEvent } from "@/components/analytics/track";
import { CheckIcon, LockIcon, TikTokIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

const initial: DropAlertState = { status: "idle", message: "" };

/**
 * Drop & restock alert sign-up. When the integration isn't switched on, the
 * form is visibly disabled and points to TikTok instead — it never pretends to
 * take an address.
 */
export function DropAlertForm({ enabled, productName, className }: { enabled: boolean; productName?: string; className?: string }) {
  const [state, formAction, pending] = useActionState(subscribeToDropAlertsAction, initial);
  const id = useId();

  useEffect(() => {
    if (state.status === "success") trackEvent("drop-alert-signup");
  }, [state.status]);

  return (
    <div className={cn("rounded-3xl bg-white p-4 ring-1 ring-inset ring-sky-200 sm:p-5", className)}>
      {state.status === "success" ? (
        <div role="status" className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint-soft text-[#0f7a60]">
            <CheckIcon className="size-5" />
          </span>
          <p className="font-display text-lg font-semibold text-ink">{state.message}</p>
        </div>
      ) : (
        <form action={enabled ? formAction : undefined} aria-describedby={`${id}-status`}>
          <label htmlFor={`${id}-email`} className="font-display text-lg font-bold text-ink">
            {productName ? `Get drop & restock alerts` : "Drop & restock alerts"}
          </label>
          <p className="mt-1 text-[0.95rem] text-ink-soft">
            {productName
              ? `We'll email when new drops or restocks are announced — including if ${productName} becomes available.`
              : "One email when a new drop or restock is announced. No spam."}
          </p>
          <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
            <label>
              Company
              <input type="text" name="company" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id={`${id}-email`}
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder={enabled ? "you@example.com" : "Alerts open soon"}
              disabled={!enabled || pending}
              className={cn(
                "min-h-12 flex-1 rounded-full px-5 text-base text-ink placeholder:text-ink-soft disabled:cursor-not-allowed",
                enabled ? "bg-white ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal" : "border-2 border-dashed border-sky-300 bg-ice-50",
              )}
            />
            <button
              type="submit"
              disabled={!enabled || pending}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-display font-semibold",
                enabled ? "bg-royal text-white shadow-[0_4px_0_var(--color-navy)] disabled:opacity-70" : "cursor-not-allowed bg-ice text-ink-soft",
              )}
            >
              {enabled ? (
                pending ? "Sending…" : "Alert me"
              ) : (
                <>
                  <LockIcon className="size-4" />
                  Not open yet
                </>
              )}
            </button>
          </div>
          {enabled && (
            <label className="mt-3 flex items-start gap-2.5 text-[0.95rem] leading-snug text-ink-soft">
              <input type="checkbox" name="consent" value="yes" required className="mt-1 size-4 accent-[var(--color-royal)]" />
              <span>
                Yes, email me about FunkSquish drops and restocks. I can unsubscribe anytime. See our{" "}
                <Link href="/privacy" className="font-semibold text-royal underline">privacy policy</Link>.
              </span>
            </label>
          )}
          {state.status === "error" && (
            <p role="alert" className="mt-3 rounded-xl bg-berry-soft px-3 py-2 text-sm text-ink">
              {state.message}
            </p>
          )}
        </form>
      )}
      <p id={`${id}-status`} className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
        {enabled ? (
          state.status !== "success" && "We'll send a confirmation email first — alerts only start after you confirm."
        ) : (
          <>
            Email alerts aren&apos;t switched on yet. Drops are announced first on TikTok — follow{" "}
            <a
              href={siteConfig.tiktok.url}
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="tiktok-click"
              className="inline-flex items-center gap-1 font-semibold text-royal underline decoration-2 underline-offset-4"
            >
              <TikTokIcon className="size-4" />
              {siteConfig.tiktok.handle}
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}
