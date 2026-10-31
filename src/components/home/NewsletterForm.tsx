"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { subscribeToLaunchList, type SignupState } from "@/app/actions/newsletter";
import { siteConfig } from "@/lib/site";
import { trackEvent } from "@/components/analytics/track";
import { CheckIcon, LockIcon, TikTokIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

const initial: SignupState = { status: "idle", message: "" };

export function NewsletterForm({ enabled, className }: { enabled: boolean; className?: string }) {
  const [state, formAction, pending] = useActionState(subscribeToLaunchList, initial);

  useEffect(() => {
    if (state.status === "success") trackEvent("newsletter-signup");
  }, [state.status]);

  const inputClass =
    "min-h-12 flex-1 rounded-full px-5 text-base text-ink placeholder:text-ink-soft disabled:cursor-not-allowed";

  return (
    <div className={cn("rounded-3xl bg-white/80 p-4 ring-1 ring-inset ring-sky-200 sm:p-5", className)}>
      {state.status === "success" ? (
        <div role="status" className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint-soft text-[#0f7a60]">
            <CheckIcon className="size-5" />
          </span>
          <p className="font-display text-lg font-semibold text-ink">{state.message}</p>
        </div>
      ) : (
        <form action={enabled ? formAction : undefined} aria-labelledby="newsletter-label" aria-describedby="newsletter-status" noValidate={false}>
          <label id="newsletter-label" htmlFor="newsletter-email" className="font-display text-lg font-bold text-ink">
            Launch emails
          </label>
          {/* Honeypot for bots — hidden from people and screen readers. */}
          <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
            <label>
              Company
              <input type="text" name="company" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="newsletter-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder={enabled ? "you@example.com" : "Email sign-ups aren't open yet"}
              disabled={!enabled || pending}
              className={cn(
                inputClass,
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
              {enabled ? (pending ? "Sending…" : "Notify me") : (
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
                Yes, email me when FunkSquish opens and about new drops. I can unsubscribe anytime. See our{" "}
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
      {!enabled && (
        <p id="newsletter-status" className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
          We aren&apos;t collecting emails yet. For launch news, follow{" "}
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
        </p>
      )}
      {enabled && state.status !== "success" && (
        <p id="newsletter-status" className="mt-2 text-sm text-ink-soft">
          We&apos;ll send a confirmation email first — you&apos;re only added after you confirm.
        </p>
      )}
    </div>
  );
}
