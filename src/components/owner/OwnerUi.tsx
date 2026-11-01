import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

/** Shared building blocks for the private owner dashboard. No data access here. */

export const card = "rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200";
export const input =
  "min-h-11 w-full rounded-2xl bg-ice-50 px-3 py-2 text-base text-ink ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal";
export const label = "grid gap-1 text-sm font-semibold text-ink";
export const button = "inline-flex min-h-11 items-center justify-center rounded-full px-5 font-display font-semibold";
export const primary = cn(button, "bg-royal text-white shadow-[0_3px_0_var(--color-navy)] hover:brightness-105");
export const secondary = cn(button, "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice");
export const danger = cn(button, "bg-white text-[#b8215a] ring-2 ring-inset ring-[#d62f6d] hover:bg-berry-soft");

/** Page frame for every owner page: never cached (the page itself calls connection()), streams behind a loading line. */
export function OwnerShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className={narrow ? "max-w-3xl" : "max-w-6xl"}>
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>{children}</Suspense>
      </Container>
    </section>
  );
}

export function PageTitle({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        {lead && <p className="mt-1 max-w-3xl text-ink-soft">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A number that came from real stored data. `note` says what it counts; never pass an estimate here. */
export function Stat({ label: l, value, note, href, tone = "plain" }: { label: string; value: ReactNode; note?: string; href?: string; tone?: "plain" | "warn" | "alert" }) {
  const body = (
    <>
      <span className="block text-sm font-semibold text-ink-soft">{l}</span>
      <span className="mt-1 block font-display text-3xl font-bold text-ink tabular-nums">{value}</span>
      {note && <span className="mt-0.5 block text-xs text-ink-soft">{note}</span>}
    </>
  );
  const cls = cn(
    "block rounded-[1.5rem] bg-white p-4 ring-1 ring-inset",
    tone === "alert" ? "ring-2 ring-[#d62f6d]" : tone === "warn" ? "ring-2 ring-lemon" : "ring-sky-200",
    href && "hover:ring-royal",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={cn(card, "text-center text-ink-soft")}>{children}</p>;
}

export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  return (
    <>
      {ok && (
        <p role="status" className="mb-4 rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">
          {ok}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">
          {error}
        </p>
      )}
    </>
  );
}

export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "alert" | "dark" }) {
  const tones = {
    plain: "bg-ice text-ink",
    good: "bg-mint-soft text-ink",
    warn: "bg-lemon-soft text-ink",
    alert: "bg-berry-soft text-ink",
    dark: "bg-ink text-white",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}

/** "Missing" marker for facts the owner hasn't entered. Never replaced by a guess. */
export function Missing({ what = "Missing" }: { what?: string }) {
  return <span className="rounded-md bg-lemon-soft px-1.5 py-0.5 text-xs font-bold text-ink">{what}</span>;
}

/** First value of a search param. */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
