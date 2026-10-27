"use client";

import { useState, type ReactNode } from "react";
import type { LiveClip, LiveSession } from "@/content/live-schedule";
import { scheduleTimeZone } from "@/content/live-schedule";
import { clipEmbedUrl, liveState, sessionWindow } from "@/lib/live";
import { useNow } from "@/lib/use-now";
import { CalendarIcon, PlayIcon, TikTokIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { buttonClasses } from "@/components/ui/Button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

const fmt = (tz?: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" });

/**
 * Status panel for the LIVE room. Status comes ONLY from the owner's schedule:
 * during a scheduled window we say it's "scheduled for now" and send people to
 * TikTok — we can't see TikTok's real status, so we never claim "LIVE now".
 */
export function LiveStatusPanel({ sessions, featured }: { sessions: LiveSession[]; featured: Record<string, ReactNode> }) {
  const nowMs = useNow();
  const known = nowMs > 0;
  const { scheduledNow, next } = liveState(sessions, new Date(known ? nowMs : 0));
  const focus = known ? (scheduledNow ?? next) : null;

  return (
    <div className="overflow-hidden rounded-[2.25rem] bg-ink text-white shadow-[var(--shadow-float)]">
      <div className="relative p-6 sm:p-8">
        <span aria-hidden="true" className="absolute inset-0 dots opacity-10" />
        {!known ? (
          <p className="relative font-display text-xl font-semibold text-sky-200">Checking the schedule…</p>
        ) : scheduledNow ? (
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-berry px-3 py-1 font-display text-sm font-bold text-ink">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-ink" />
              Scheduled for right now
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{scheduledNow.title}</h2>
            <p className="mt-2 text-sky-200">
              This LIVE is on our schedule for now. Open TikTok to join — if we&apos;re running a few minutes late, hang tight!
            </p>
          </div>
        ) : next ? (
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-display text-sm font-semibold ring-1 ring-inset ring-white/25">
              <CalendarIcon className="size-4" /> Next LIVE
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{next.title}</h2>
            <SessionTimes session={next} />
            {next.note && <p className="mt-2 text-sky-200">{next.note}</p>}
          </div>
        ) : (
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Mascot className="w-24 shrink-0" mood="sleepy" />
            <div>
              <h2 className="font-display text-3xl font-bold">We&apos;re not live right now</h2>
              <p className="mt-2 max-w-lg text-sky-200">
                No LIVE is scheduled yet. We announce every stream on TikTok first — follow so you get the notification.
              </p>
            </div>
          </div>
        )}

        <div className="relative mt-6 flex flex-wrap gap-3">
          <a
            href={siteConfig.tiktok.url}
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="tiktok-click"
            className={buttonClasses({ variant: "secondary" })}
          >
            <TikTokIcon className="size-5" />
            {scheduledNow ? "Open TikTok" : `Follow ${siteConfig.tiktok.handle}`}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {focus && !scheduledNow && (
            <a href={`/tiktok-live/calendar/${focus.id}`} download className={buttonClasses({ variant: "ghost", className: "text-white ring-1 ring-inset ring-white/30 hover:bg-white/10" })}>
              <CalendarIcon className="size-5" />
              Add to calendar
            </a>
          )}
        </div>
      </div>
      {focus && featured[focus.id] && (
        <div className="bg-white/5 p-6 ring-1 ring-inset ring-white/10 sm:p-8">
          <p className="font-display text-lg font-bold">On the table this time</p>
          <p className="text-sm text-sky-200">Sample designs we plan to show — not products for sale.</p>
          <div className="mt-4">{featured[focus.id]}</div>
        </div>
      )}
    </div>
  );
}

function SessionTimes({ session }: { session: LiveSession }) {
  const w = sessionWindow(session);
  if (!w) return null;
  const local = fmt().format(w.start);
  const ours = fmt(scheduleTimeZone).format(w.start);
  return (
    <p className="mt-2 font-display text-lg font-semibold">
      <time dateTime={session.startsAt}>{local}</time>
      {local !== ours && <span className="block text-sm font-normal text-sky-200">({ours} for us)</span>}
    </p>
  );
}

/** Upcoming list (shown in the visitor's own time zone). */
export function UpcomingLives({ sessions }: { sessions: LiveSession[] }) {
  const nowMs = useNow();
  if (!nowMs) return null;
  const { upcoming } = liveState(sessions, new Date(nowMs));
  if (upcoming.length < 2) return null;
  return (
    <ul className="mt-4 space-y-2">
      {upcoming.slice(1, 6).map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ice-50 px-4 py-3 ring-1 ring-inset ring-sky-200">
          <span>
            <span className="block font-display font-semibold text-ink">{s.title}</span>
            <time dateTime={s.startsAt} className="text-sm text-ink-soft">{fmt().format(new Date(s.startsAt))}</time>
          </span>
          <a href={`/tiktok-live/calendar/${s.id}`} download className="font-display text-sm font-semibold text-royal underline underline-offset-4">
            Add to calendar
          </a>
        </li>
      ))}
    </ul>
  );
}

/** A clip that only contacts TikTok after the visitor taps play. */
export function ClipCard({ clip }: { clip: LiveClip }) {
  const [open, setOpen] = useState(false);
  const src = clipEmbedUrl(clip);
  if (!src) return null;
  return (
    <figure className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-inset ring-sky-200">
      <div className="relative aspect-[9/16] bg-ink">
        {open ? (
          <iframe
            src={src}
            title={`TikTok video: ${clip.title}`}
            allow="encrypted-media; fullscreen; picture-in-picture"
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="group absolute inset-0 grid place-items-center text-white">
            <span className="grid size-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/60 transition-transform group-hover:scale-110">
              <PlayIcon className="size-7" />
            </span>
            <span className="absolute inset-x-3 bottom-3 text-center text-xs text-sky-200">Plays from TikTok</span>
            <span className="sr-only">Play {clip.title} (loads TikTok)</span>
          </button>
        )}
      </div>
      <figcaption className={cn("px-4 py-3 font-display font-semibold text-ink")}>{clip.title}</figcaption>
    </figure>
  );
}
