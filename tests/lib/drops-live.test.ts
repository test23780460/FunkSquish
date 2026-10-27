import { describe, expect, it } from "vitest";
import { drops, type Drop } from "@/content/drops";
import { liveClips, liveSchedule, approvedLiveLinks } from "@/content/live-schedule";
import { countdownParts, dropView, sortDrops } from "@/lib/drops";
import { buildIcs, clipEmbedUrl, isTikTokVideoId, liveState } from "@/lib/live";
import { listProducts } from "@/commerce/catalog";

const base: Drop = { id: "d", title: "Drop", kind: "new", status: "planned", summary: "", collections: [], productSlugs: [] };
const now = new Date("2027-01-10T12:00:00Z");

describe("drops", () => {
  it("only counts down for an announced drop with a confirmed future date", () => {
    expect(dropView({ ...base, status: "announced", startsAt: "2027-01-11T12:00:00Z" }, now).kind).toBe("countdown");
    expect(dropView({ ...base, status: "planned", startsAt: "2027-01-11T12:00:00Z" }, now).kind).toBe("tba");
    expect(dropView({ ...base, status: "announced" }, now).kind).toBe("tba");
    expect(dropView({ ...base, status: "announced", startsAt: "not a date" }, now).kind).toBe("tba");
    expect(dropView({ ...base, status: "announced", startsAt: "2027-01-01T00:00:00Z" }, now).kind).toBe("date-passed");
    expect(countdownParts(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(countdownParts(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("published drop content follows the honesty rules", async () => {
    const slugs = new Set((await listProducts()).map((p) => p.slug));
    for (const d of drops) {
      // A date may only be given on an announced/out-now/ended drop, never on a "planned" one.
      if (d.status === "planned") expect(d.startsAt).toBeUndefined();
      if (d.startsAt) expect(d.startsAt).toMatch(/T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/);
      for (const s of d.productSlugs) expect(slugs.has(s)).toBe(true);
    }
  });

  it("sorts live and upcoming drops first", () => {
    const list = sortDrops([
      { ...base, id: "ended", status: "ended" },
      { ...base, id: "later", status: "announced", startsAt: "2027-03-01T00:00:00Z" },
      { ...base, id: "soon", status: "announced", startsAt: "2027-02-01T00:00:00Z" },
      { ...base, id: "now", status: "out-now" },
    ]);
    expect(list.map((d) => d.id)).toEqual(["now", "soon", "later", "ended"]);
  });
});

describe("TikTok LIVE room", () => {
  const s1 = { id: "a", title: "A", startsAt: "2027-01-10T11:30:00Z" }; // default 60-minute window -> on now
  const s2 = { id: "b", title: "B", startsAt: "2027-01-12T00:00:00Z", endsAt: "2027-01-12T01:00:00Z" };
  const bad = { id: "c", title: "C", startsAt: "soon!" };

  it("derives status only from the schedule", () => {
    const st = liveState([s2, bad, s1], now);
    expect(st.scheduledNow?.id).toBe("a");
    expect(st.next?.id).toBe("b");
    expect(liveState([], now)).toEqual({ scheduledNow: null, next: null, upcoming: [] });
    expect(liveState([s1], new Date("2027-01-10T12:31:00Z")).scheduledNow).toBeNull();
  });

  it("builds a safe calendar file", () => {
    const ics = buildIcs({ ...s2, title: "Squish, test; part\n2", note: "Line1\nLine2" }, { url: "https://www.tiktok.com/@funksquish", stamp: new Date(s2.startsAt) })!;
    expect(ics).toContain("DTSTART:20270112T000000Z");
    expect(ics).toContain(String.raw`SUMMARY:FunkSquish LIVE: Squish\, test\; part\n2`);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(buildIcs(bad, { url: "x", stamp: now })).toBeNull();
  });

  it("only embeds real TikTok video ids", () => {
    expect(isTikTokVideoId("7312345678901234567")).toBe(true);
    for (const id of ["", "abc", "123", "7312345678901234567?x=<script>", "../../evil"]) expect(isTikTokVideoId(id)).toBe(false);
    expect(clipEmbedUrl({ id: "x", title: "t", videoId: "javascript:alert(1)", postedAt: "2027-01-01" })).toBeNull();
  });

  it("published LIVE content is valid", () => {
    for (const s of liveSchedule) expect(Number.isNaN(new Date(s.startsAt).getTime())).toBe(false);
    for (const c of liveClips) expect(isTikTokVideoId(c.videoId)).toBe(true);
    for (const l of approvedLiveLinks) expect(l.href).toMatch(/^https:\/\/www\.tiktok\.com\/@funksquish/);
  });
});
