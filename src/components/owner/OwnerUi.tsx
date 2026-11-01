import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

/**
 * Shared building blocks for the private owner dashboard (no data access here).
 *
 * One visual system for every owner page: white cards on a soft sky backdrop,
 * one button family (primary / secondary / danger / quiet, two sizes), calm
 * form fields, status pills with a coloured dot, and filter chips that scroll
 * sideways on phones instead of stacking up. Colours always pair with text
 * (never colour alone), and motion respects reduced-motion settings.
 */

/* ---------------------------------- tokens ---------------------------------- */

export const card = "rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_12px_32px_-20px_rgba(19,53,122,0.28)] ring-1 ring-sky-100 sm:p-6";
/** A quieter inner panel (inside a card). */
export const panel = "rounded-2xl bg-ice-50/80 p-4 ring-1 ring-inset ring-sky-100";

export const input =
  "min-h-11 w-full rounded-xl bg-white px-3.5 py-2 text-base text-ink shadow-[inset_0_1px_2px_rgba(19,53,122,0.06)] ring-1 ring-inset ring-sky-200 transition-shadow placeholder:text-ink-soft/60 hover:ring-sky-300 focus:outline-none focus:ring-2 focus:ring-royal disabled:cursor-not-allowed disabled:bg-ice-50 disabled:text-ink-soft motion-reduce:transition-none";
export const label = "grid gap-1.5 text-sm font-semibold text-ink";
/** Native file picker styled to match the buttons. */
export const fileInput =
  "block w-full rounded-xl bg-white text-sm text-ink-soft ring-1 ring-inset ring-sky-200 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-l-xl file:border-0 file:bg-ink file:px-4 file:font-display file:font-semibold file:text-white hover:file:bg-navy focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-royal";
export const hint = "text-xs font-normal leading-relaxed text-ink-soft";

const focus = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-royal";
export const button = cn(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-center font-display text-[0.95rem] font-semibold leading-tight transition-[background-color,box-shadow,transform,filter] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0",
  focus,
);
export const primary = cn(button, "bg-royal text-white shadow-[0_2px_0_var(--color-navy)] hover:brightness-110");
export const secondary = cn(button, "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice-50 hover:ring-sky-300");
export const danger = cn(button, "bg-white text-[#a3174f] ring-1 ring-inset ring-[#eba3bf] hover:bg-berry-soft");
/** Text-style action (links that look like actions, low-emphasis buttons). */
export const quiet = cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-royal underline-offset-4 hover:underline", focus);
/** Add to any button for a compact size (lists, rows). */
export const small = "min-h-9 px-3.5 text-sm";

/* ---------------------------------- layout ---------------------------------- */

/** Page frame for every owner page: never cached (the page itself calls connection()), streams behind a loading state. */
export function OwnerShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <section data-owner-area className="min-h-screen bg-[linear-gradient(180deg,var(--color-ice)_0,var(--color-ice-50)_22rem)] pb-24 pt-24 sm:pt-28">
      <Container className={narrow ? "max-w-3xl" : "max-w-6xl"}>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </Container>
    </section>
  );
}

export function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-11 w-full max-w-2xl animate-pulse rounded-2xl bg-white/70 motion-reduce:animate-none" />
      <div className="h-9 w-56 animate-pulse rounded-xl bg-white/70 motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/70 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

export function PageTitle({ title, lead, actions, eyebrow, meta }: { title: string; lead?: ReactNode; actions?: ReactNode; eyebrow?: string; meta?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.14em] text-royal">{eyebrow}</p>}
        <h1 className="font-display text-[1.85rem] font-bold leading-tight text-ink sm:text-[2.25rem]">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div>}
        {lead && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** A titled card. `id` labels the region; `count` shows a small number badge next to the title. */
export function Section({
  id,
  title,
  description,
  actions,
  count,
  tone = "plain",
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  count?: number;
  tone?: "plain" | "warn" | "alert";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(card, tone === "warn" && "ring-2 ring-lemon", tone === "alert" && "ring-2 ring-[#eba3bf]", className)}>
      <header className={cn("flex flex-wrap items-start justify-between gap-3", children !== undefined && "mb-4")}>
        <div className="min-w-0">
          <h2 id={id} className="flex flex-wrap items-center gap-2 font-display text-lg font-bold leading-snug text-ink sm:text-xl">
            {title}
            {count !== undefined && <Count n={count} tone={tone} />}
          </h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** A small number badge (used next to headings). */
export function Count({ n, tone = "plain" }: { n: number; tone?: "plain" | "warn" | "alert" }) {
  const t = n === 0 ? "bg-ice text-ink-soft" : tone === "alert" ? "bg-[#a3174f] text-white" : tone === "warn" ? "bg-lemon text-ink" : "bg-ink text-white";
  return <span className={cn("inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 font-sans text-xs font-bold tabular-nums", t)}>{n}</span>;
}

/* ------------------------------- numbers & status ------------------------------- */

const STAT_TONE = {
  plain: { box: "bg-white ring-sky-100", dot: "bg-sky-300" },
  warn: { box: "bg-[#fffbea] ring-[#f3dd8a]", dot: "bg-[#e0a800]" },
  alert: { box: "bg-[#fff4f8] ring-[#f2b9cd]", dot: "bg-[#d62f6d]" },
} as const;

/** A number that came from real stored data. `note` says what it counts; never pass an estimate here. */
export function Stat({ label: l, value, note, href, tone = "plain" }: { label: string; value: ReactNode; note?: string; href?: string; tone?: "plain" | "warn" | "alert" }) {
  const t = STAT_TONE[tone];
  const body = (
    <>
      <span className="flex items-center gap-2 text-[0.82rem] font-semibold leading-snug text-ink-soft">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", t.dot)} />
        {l}
      </span>
      <span className="mt-2 block font-display text-[1.7rem] font-bold leading-none text-ink tabular-nums sm:text-3xl">{value}</span>
      {note && <span className="mt-1.5 block text-xs leading-snug text-ink-soft">{note}</span>}
      {href && (
        <span aria-hidden="true" className="absolute right-3.5 top-3.5 text-ink-soft/60 transition-transform group-hover:translate-x-0.5 group-hover:text-royal motion-reduce:transition-none">
          →
        </span>
      )}
    </>
  );
  const cls = cn("group relative block rounded-2xl p-4 pr-8 shadow-[0_1px_2px_rgba(19,53,122,0.05)] ring-1 ring-inset", t.box);
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow hover:ring-2 hover:ring-royal motion-reduce:transition-none", focus)}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A labelled group of stats. */
export function StatGroup({ id, title, children, cols = 4 }: { id: string; title: string; children: ReactNode; cols?: 3 | 4 }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </h2>
      <div className={cn("grid grid-cols-2 gap-3", cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>{children}</div>
    </section>
  );
}

const PILL_TONE = {
  plain: { box: "bg-ice-50 text-ink ring-sky-200", dot: "bg-sky-300" },
  good: { box: "bg-mint-soft text-ink ring-[#9fe3cf]", dot: "bg-[#1d9e7e]" },
  warn: { box: "bg-lemon-soft text-ink ring-[#f3dd8a]", dot: "bg-[#d49b00]" },
  alert: { box: "bg-berry-soft text-ink ring-[#f2b9cd]", dot: "bg-[#d62f6d]" },
  info: { box: "bg-[#e9f0ff] text-ink ring-[#bcd0fb]", dot: "bg-royal" },
  dark: { box: "bg-ink text-white ring-ink", dot: "bg-white" },
} as const;
export type PillTone = keyof typeof PILL_TONE;

/** Status label. The dot repeats the meaning in colour; the words always carry it. */
export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: PillTone }) {
  const t = PILL_TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none ring-1 ring-inset", t.box)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/** "Missing" marker for facts the owner hasn't entered. Never replaced by a guess. */
export function Missing({ what = "Missing" }: { what?: string }) {
  return <span className="rounded-md bg-lemon-soft px-1.5 py-0.5 text-xs font-bold text-ink ring-1 ring-inset ring-[#f3dd8a]">{what}</span>;
}

/** A thin progress bar with its numbers in words (e.g. launch checklist 7/12). */
export function Progress({ done, total, label: l }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-soft">
        <span>{l}</span>
        <span className="tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ice" role="progressbar" aria-label={l} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className={cn("h-full rounded-full", done === total ? "bg-[#1d9e7e]" : "bg-royal")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------ messages & empty ------------------------------ */

function Icon({ kind }: { kind: "ok" | "warn" | "alert" | "info" }) {
  const cls = {
    ok: "bg-[#1d9e7e] text-white",
    warn: "bg-[#e0a800] text-ink",
    alert: "bg-[#d62f6d] text-white",
    info: "bg-royal text-white",
  }[kind];
  return (
    <span aria-hidden="true" className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-black", cls)}>
      {kind === "ok" ? "✓" : kind === "info" ? "i" : "!"}
    </span>
  );
}

export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  return (
    <>
      {ok && (
        <p role="status" className="mb-5 flex items-start gap-3 rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink ring-1 ring-inset ring-[#9fe3cf]">
          <Icon kind="ok" />
          <span>{ok}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 flex items-start gap-3 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink ring-1 ring-inset ring-[#f2b9cd]">
          <Icon kind="alert" />
          <span>{error}</span>
        </p>
      )}
    </>
  );
}

/** A banner for standing facts (test mode, switched-off features). */
export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "alert" | "ok"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const box = { info: "bg-[#eef3ff] ring-[#bcd0fb]", warn: "bg-lemon-soft ring-[#f3dd8a]", alert: "bg-berry-soft ring-[#f2b9cd]", ok: "bg-mint-soft ring-[#9fe3cf]" }[tone];
  return (
    <div role="note" className={cn("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-ink ring-1 ring-inset", box, className)}>
      <Icon kind={tone === "ok" ? "ok" : tone} />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn("leading-relaxed", !!title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** A list of things to look at, each optionally linking to where it's fixed. */
export function Notices({ items, tone = "warn" }: { items: { text: ReactNode; href?: string }[]; tone?: "warn" | "alert" | "info" }) {
  return (
    <ul className="divide-y divide-sky-100 overflow-hidden rounded-2xl ring-1 ring-inset ring-sky-100">
      {items.map((w, i) => {
        const body = (
          <>
            <Icon kind={tone} />
            <span className="min-w-0 flex-1 leading-snug">{w.text}</span>
            {w.href && (
              <span aria-hidden="true" className="shrink-0 text-ink-soft group-hover:text-royal">
                →
              </span>
            )}
          </>
        );
        return (
          <li key={i}>
            {w.href ? (
              <Link href={w.href} className={cn("group flex items-start gap-3 bg-white px-4 py-3 text-sm text-ink hover:bg-ice-50", focus)}>
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 bg-white px-4 py-3 text-sm text-ink">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** An intentional "nothing here yet" state. Keep `children` short; add an action when there's an obvious next step. */
export function Empty({ children, title, action, compact = false }: { children?: ReactNode; title?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn(compact ? "rounded-2xl bg-ice-50/70 px-4 py-5 ring-1 ring-inset ring-sky-100" : cn(card, "py-10"), "text-center")}>
      {!compact && (
        <span aria-hidden="true" className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-ice text-xl text-royal">
          ✦
        </span>
      )}
      {title && <p className="font-display text-lg font-bold text-ink">{title}</p>}
      {children && <div className={cn("mx-auto max-w-xl text-sm leading-relaxed text-ink-soft", !!title && "mt-1")}>{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------- filters & tables ------------------------------- */

/** Filter chips: one row that scrolls sideways on phones, wraps on wider screens. */
export function Chips({ label: l, items }: { label: string; items: { href: string; label: ReactNode; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label={l} className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors motion-reduce:transition-none",
                i.active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice-50",
                focus,
              )}
            >
              {i.label}
              {i.count !== undefined && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", i.active ? "bg-white/20" : "bg-ice text-ink-soft")}>{i.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Search box used above lists (a plain GET form). */
export function SearchBar({ action, name = "q", value, placeholder, label: l, hidden }: { action: string; name?: string; value?: string; placeholder: string; label: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} role="search" className="flex w-full max-w-xl gap-2">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{l}</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">
          ⌕
        </span>
        <input type="search" name={name} defaultValue={value} placeholder={placeholder} className={cn(input, "rounded-full pl-9")} />
      </label>
      <button className={secondary}>Search</button>
    </form>
  );
}

/** Table styles: wrap a <table> in `tableWrap` so it scrolls inside its card on small screens. */
export const tableWrap = "-mx-1 overflow-x-auto rounded-2xl ring-1 ring-inset ring-sky-100";
export const table = "w-full min-w-[34rem] border-collapse text-left text-sm";
export const th = "bg-ice-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft first:rounded-tl-2xl last:rounded-tr-2xl";
export const td = "border-t border-sky-100 px-4 py-3 align-middle text-ink";

/* ---------------------------------- helpers ---------------------------------- */

/** First value of a search param. */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
