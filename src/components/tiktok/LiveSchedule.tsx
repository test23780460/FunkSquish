import { liveSchedule, scheduleTimeZone } from "@/content/live-schedule";
import { CalendarIcon } from "@/components/icons/Icons";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: scheduleTimeZone,
  timeZoneName: "short",
});

/** Upcoming LIVE list. Shows an honest empty state until dates are announced. */
export function LiveSchedule({ invert = false, className }: { invert?: boolean; className?: string }) {
  const sessions = liveSchedule;

  return (
    <div
      className={cn(
        "rounded-[2rem] p-5 sm:p-6",
        invert ? "bg-white/10 ring-1 ring-inset ring-white/20" : "bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 place-items-center rounded-xl", invert ? "bg-white/15 text-white" : "bg-ice text-royal")}>
          <CalendarIcon className="size-5" />
        </span>
        <h3 className={cn("font-display text-xl font-bold", invert ? "text-white" : "text-ink")}>LIVE schedule</h3>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-4 space-y-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3",
                invert ? "border-white/20" : "border-sky-200",
              )}
            >
              <span className={cn("h-3 w-16 rounded-full", invert ? "bg-white/20" : "bg-ice")} />
              <span className={cn("h-3 flex-1 rounded-full", invert ? "bg-white/10" : "bg-ice-50")} />
            </div>
          ))}
          <p className={cn("pt-1 leading-relaxed", invert ? "text-sky-200" : "text-ink-soft")}>
            No LIVEs are scheduled yet. We&apos;ll announce our first stream on TikTok — follow{" "}
            <a
              href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click"
              target="_blank"
              rel="noopener noreferrer"
              className={cn("font-semibold underline decoration-2 underline-offset-4", invert ? "text-white" : "text-royal")}
            >
              {siteConfig.tiktok.handle}
            </a>{" "}
            so you don&apos;t miss it.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={cn("rounded-2xl px-4 py-3", invert ? "bg-white/10" : "bg-ice-50 ring-1 ring-inset ring-sky-200")}
            >
              <p className={cn("font-display font-semibold", invert ? "text-white" : "text-ink")}>{s.title}</p>
              <p className={cn("text-sm", invert ? "text-sky-200" : "text-ink-soft")}>
                <time dateTime={s.startsAt}>{fmt.format(new Date(s.startsAt))}</time>
                {s.note ? ` · ${s.note}` : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
