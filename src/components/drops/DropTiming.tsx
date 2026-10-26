"use client";

import type { Drop } from "@/content/drops";
import { dropTimeZone } from "@/content/drops";
import { countdownParts, dropView } from "@/lib/drops";
import { useNow } from "@/lib/use-now";
import { CalendarIcon } from "@/components/icons/Icons";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: dropTimeZone,
  timeZoneName: "short",
});

/**
 * Date block for a drop. Countdown only for an announced drop with a
 * confirmed future date; otherwise an honest label. Never a made-up timer.
 */
export function DropTiming({ drop }: { drop: Drop }) {
  const nowMs = useNow();
  const known = nowMs > 0;
  const view = dropView(drop, new Date(known ? nowMs : 0));

  if (drop.status === "announced" && drop.startsAt && !Number.isNaN(new Date(drop.startsAt).getTime())) {
    const start = new Date(drop.startsAt);
    const parts = countdownParts(start.getTime() - nowMs);
    return (
      <div className="rounded-3xl bg-ice-50 p-4 ring-1 ring-inset ring-sky-200">
        <p className="flex items-center gap-2 font-display font-semibold text-ink">
          <CalendarIcon className="size-5 text-royal" />
          <time dateTime={drop.startsAt}>{fmt.format(start)}</time>
        </p>
        {known && view.kind === "countdown" && (
          <div role="timer" aria-label={`Starts in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`} className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["days", parts.days],
                ["hours", parts.hours],
                ["min", parts.minutes],
                ["sec", parts.seconds],
              ] as const
            ).map(([label, n]) => (
              <div key={label} aria-hidden="true" className="rounded-2xl bg-white py-2 ring-1 ring-inset ring-sky-200">
                <span className="block font-display text-2xl font-bold tabular-nums text-ink">{String(n).padStart(2, "0")}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
              </div>
            ))}
          </div>
        )}
        {known && view.kind === "date-passed" && (
          <p className="mt-2 text-ink-soft">This date has passed. Check TikTok for the latest — we&apos;ll update this page soon.</p>
        )}
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 rounded-3xl bg-ice-50 px-4 py-3 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
      <CalendarIcon className="size-5 text-royal" />
      {view.kind === "out-now" ? "Out now" : view.kind === "ended" ? "This drop has ended" : view.kind === "tba" ? view.label : "Date to be announced"}
    </p>
  );
}
