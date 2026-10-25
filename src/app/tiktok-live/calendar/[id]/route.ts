import type { NextRequest } from "next/server";
import { liveSchedule } from "@/content/live-schedule";
import { buildIcs, sessionWindow } from "@/lib/live";
import { siteConfig } from "@/lib/site";

/** "Add to calendar" file for one scheduled LIVE. 404 for anything not in the schedule. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/tiktok-live/calendar/[id]">) {
  const { id } = await ctx.params;
  const session = liveSchedule.find((s) => s.id === id.replace(/\.ics$/, ""));
  const window = session ? sessionWindow(session) : null;
  if (!session || !window) return new Response("Not found", { status: 404 });

  // DTSTAMP uses the start time so the file is deterministic (and cacheable).
  const ics = buildIcs(session, { url: siteConfig.tiktok.url, stamp: window.start });
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="funksquish-live-${session.id.replace(/[^a-z0-9-]/gi, "")}.ics"`,
    },
  });
}
