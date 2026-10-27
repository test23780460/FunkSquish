import type { LiveClip, LiveSession } from "@/content/live-schedule";

const DEFAULT_MINUTES = 60;

export function sessionWindow(s: LiveSession): { start: Date; end: Date } | null {
  const start = new Date(s.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = s.endsAt ? new Date(s.endsAt) : null;
  const end = endRaw && !Number.isNaN(endRaw.getTime()) && endRaw > start ? endRaw : new Date(start.getTime() + DEFAULT_MINUTES * 60_000);
  return { start, end };
}

/**
 * What the LIVE room may say right now: a session whose scheduled window
 * includes `now` (we say "scheduled for now", never "we're live"), and the
 * next upcoming session. Invalid dates are skipped.
 */
export function liveState(sessions: LiveSession[], now: Date): { scheduledNow: LiveSession | null; next: LiveSession | null; upcoming: LiveSession[] } {
  const valid = sessions
    .map((s) => ({ s, w: sessionWindow(s) }))
    .filter((x): x is { s: LiveSession; w: { start: Date; end: Date } } => !!x.w)
    .sort((a, b) => a.w.start.getTime() - b.w.start.getTime());
  const t = now.getTime();
  const scheduledNow = valid.find((x) => x.w.start.getTime() <= t && t < x.w.end.getTime())?.s ?? null;
  const upcoming = valid.filter((x) => x.w.start.getTime() > t).map((x) => x.s);
  return { scheduledNow, next: upcoming[0] ?? null, upcoming };
}

/** TikTok video ids are long numbers. Anything else is rejected (no arbitrary embeds). */
export function isTikTokVideoId(id: string) {
  return /^\d{15,25}$/.test(id);
}

export function clipEmbedUrl(clip: LiveClip): string | null {
  return isTikTokVideoId(clip.videoId) ? `https://www.tiktok.com/player/v1/${clip.videoId}?autoplay=1&rel=0` : null;
}

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** A minimal, valid iCalendar file for one scheduled LIVE. */
export function buildIcs(s: LiveSession, opts: { url: string; stamp: Date }): string | null {
  const w = sessionWindow(s);
  if (!w) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FunkSquish//TikTok LIVE//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${s.id.replace(/[^a-z0-9-]/gi, "")}@funksquish.com`,
    `DTSTAMP:${icsDate(opts.stamp)}`,
    `DTSTART:${icsDate(w.start)}`,
    `DTEND:${icsDate(w.end)}`,
    `SUMMARY:${icsText(`FunkSquish LIVE: ${s.title}`)}`,
    `DESCRIPTION:${icsText(`${s.note ? `${s.note}\n` : ""}Watch on TikTok: ${opts.url}`)}`,
    `URL:${opts.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
