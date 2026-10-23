import { features } from "@/lib/features";
import { siteConfig } from "@/lib/site";
import { LockIcon, TikTokIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

/**
 * Email sign-up — DISABLED until a real email service is connected.
 *
 * The form is rendered in its final layout but every control is disabled and
 * it has no action, so no email address can be entered or "saved".
 * To enable: connect a provider (see docs/ECOMMERCE-ROADMAP.md), add a server
 * action that calls it, pass it as `<form action={subscribe}>`, then set
 * `features.newsletter = true`. Both are required, so flipping the flag alone
 * can never turn on a form that goes nowhere.
 */
const subscribeAction: ((formData: FormData) => Promise<void>) | null = null;

export function NewsletterSignup({ className }: { className?: string }) {
  const enabled = features.newsletter && subscribeAction !== null;

  return (
    <div className={cn("rounded-3xl bg-white/80 p-4 ring-1 ring-inset ring-sky-200 sm:p-5", className)}>
      <form method="post" action={enabled ? (subscribeAction ?? undefined) : undefined} aria-labelledby="newsletter-label" aria-describedby="newsletter-status">
        <label id="newsletter-label" htmlFor="newsletter-email" className="font-display text-lg font-bold text-ink">
          Launch emails
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="newsletter-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email sign-ups open soon"
            disabled={!enabled}
            className="min-h-12 flex-1 cursor-not-allowed rounded-full border-2 border-dashed border-sky-300 bg-ice-50 px-5 text-base text-ink placeholder:text-ink-soft disabled:opacity-100"
          />
          <button
            type="submit"
            disabled={!enabled}
            className="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ice px-6 font-display font-semibold text-ink-soft"
          >
            <LockIcon className="size-4" />
            Not open yet
          </button>
        </div>
      </form>
      <p id="newsletter-status" className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
        We aren&apos;t collecting emails yet. For launch news, follow{" "}
        <a
          href={siteConfig.tiktok.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-royal underline decoration-2 underline-offset-4"
        >
          <TikTokIcon className="size-4" />
          {siteConfig.tiktok.handle}
        </a>
        .
      </p>
    </div>
  );
}
