import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
const connection = vi.fn(async () => {});
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), connection: () => connection() }));
const auth = { signedIn: true, configured: true };
vi.mock("@/lib/partners/config", async (orig) => ({ ...(await orig<object>()), reviewConfig: () => (auth.configured ? { secret: "x" } : null) }));
vi.mock("@/lib/partners/review-auth", () => ({ requireReviewer: async () => (auth.signedIn ? { cfg: {}, stores: {} } : null) }));
const ctx = { store: null as unknown };
vi.mock("@/commerce/orders/inventory-context", () => ({
  inventoryContext: async () => ({
    mode: "test",
    label: "TEST stock",
    store: ctx.store,
    items: [{ variantId: "v1", productName: "Berry Jelly", variantName: "Berry, \"big\"" }],
  }),
}));

import { MemoryKvStore } from "@/lib/storage/kv-core";
import { adjustStock, undoAdjustment } from "@/commerce/orders/stock-admin";
import { EXPORT_COLUMNS, MAX_EXPORT_DAYS, csvText, easternDate, loadHistory, parseExportRange, toCsv } from "@/commerce/orders/stock-export";
import { GET } from "@/app/partners/review/inventory/export/route";

let store: MemoryKvStore;
beforeEach(() => {
  store = new MemoryKvStore();
  ctx.store = store;
  auth.signedIn = true;
  auth.configured = true;
  vi.spyOn(console, "info").mockImplementation(() => {});
});

const record = (at: string, kind: "tiktok-sale" | "received" | "correction" | "count", quantity: number, note?: string) =>
  adjustStock(store, { variantId: "v1", sku: "FS-BERRY", kind, quantity, note, requestId: randomUUID(), catalogOnHand: 20 }, new Date(at));

describe("CSV safety", () => {
  it("quotes text and neutralises spreadsheet formulas", () => {
    expect(csvText("plain")).toBe('"plain"');
    expect(csvText('say "hi", ok')).toBe('"say ""hi"", ok"');
    for (const bad of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) expect(csvText(bad).startsWith(`"'`)).toBe(true);
    expect(csvText("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("date range", () => {
  const now = new Date("2026-11-03T15:00:00Z");
  it("defaults to the last 30 days (Eastern Time)", () => {
    expect(parseExportRange(null, null, now)).toEqual({ ok: true, from: "2026-10-05", to: "2026-11-03" });
  });
  it("refuses bad, reversed or too-long ranges", () => {
    expect(parseExportRange("2026-02-30", "2026-03-01", now).ok).toBe(false);
    expect(parseExportRange("11/01/2026", null, now).ok).toBe(false);
    expect(parseExportRange("2026-11-03", "2026-11-01", now).ok).toBe(false);
    expect(parseExportRange("2026-01-01", "2026-12-31", now)).toMatchObject({ ok: false, error: expect.stringContaining(`${MAX_EXPORT_DAYS} days`) });
    expect(parseExportRange("2026-08-04", "2026-11-03", now).ok).toBe(true); // exactly 92 days
  });
  it("uses the owner's (Eastern) calendar day", () => {
    expect(easternDate(new Date("2026-11-04T02:30:00Z"))).toBe("2026-11-03");
  });
});

describe("history file", () => {
  it("contains every change in the range, oldest first, by Eastern date", async () => {
    await record("2026-11-02T14:00:00Z", "received", 5);
    await record("2026-11-03T14:00:00Z", "tiktok-sale", 2);
    await record("2026-11-04T02:30:00Z", "tiktok-sale", 1); // 9:30 pm Nov 3 in Kentucky
    await record("2026-11-04T15:00:00Z", "tiktok-sale", 1);
    const r = await loadHistory(store, "2026-11-03", "2026-11-03");
    expect(r.ok && r.rows.map((a) => [a.at, a.delta])).toEqual([
      ["2026-11-03T14:00:00.000Z", -2],
      ["2026-11-04T02:30:00.000Z", -1],
    ]);
  });

  it("has a header row, shelf counts, who recorded it, notes and undo marks — and no customer details", async () => {
    const sale = await record("2026-11-03T14:00:00Z", "tiktok-sale", 2);
    await record("2026-11-03T15:00:00Z", "correction", -1, "=HYPERLINK(\"http://evil\") found a torn one");
    if (!sale.ok || !sale.adjustment) throw new Error("sale not recorded");
    expect((await undoAdjustment(store, "v1", sale.adjustment.id, new Date("2026-11-03T16:00:00Z"))).ok).toBe(true);
    const r = await loadHistory(store, "2026-11-03", "2026-11-03");
    if (!r.ok) throw new Error(r.error);
    const csv = toCsv(r.rows, new Map([["v1", { product: "Berry Jelly", variant: "Berry" }]]));
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.map((c) => `"${c}"`).join(","));
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"Sold on TikTok",-2,20,18,"Owner"');
    expect(lines[1]).toContain('"yes"'); // undone
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://evil"") found a torn one"`);
    expect(lines[3]).toContain('"Undo"');
    expect(csv).not.toMatch(/@|address|email/i);
  });

  it("refuses periods with too many changes rather than timing out", async () => {
    const big = new MemoryKvStore();
    for (let i = 0; i < 50_001; i++) await big.create(`invlog/2026-11-03/2026-11-03T14:00:00.000Z-${i}`, {});
    expect(await loadHistory(big, "2026-11-03", "2026-11-03")).toMatchObject({ ok: false });
  });
});

describe("download (owner only)", () => {
  const req = (q = "") => new Request(`https://funksquish.com/partners/review/inventory/export${q}`);

  it("signed out (or the owner area isn't set up): plain 404, no data", async () => {
    await record("2026-11-03T14:00:00Z", "tiktok-sale", 2);
    auth.signedIn = false;
    let res = await GET(req());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
    expect(res.headers.get("cache-control")).toContain("no-store");
    auth.signedIn = true;
    auth.configured = false;
    res = await GET(req());
    expect(res.status).toBe(404);
  });

  it("signed in: a CSV attachment that's never cached or indexed", async () => {
    await record("2026-11-03T14:00:00Z", "tiktok-sale", 2);
    const res = await GET(req("?from=2026-11-01&to=2026-11-03"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="TEST-funksquish-inventory-history-2026-11-01-to-2026-11-03.csv"');
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(connection).toHaveBeenCalled(); // per request — never prerendered at build time
    const body = await res.text();
    expect(body).toContain('"Berry Jelly","Berry, ""big""","FS-BERRY","Sold on TikTok",-2');
    expect(JSON.stringify((console.info as unknown as ReturnType<typeof vi.spyOn>).mock.calls)).not.toContain("Berry");
  });

  it("a bad range gets a plain explanation", async () => {
    const res = await GET(req("?from=2026-01-01&to=2026-12-31"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("days or fewer");
  });
});

describe("no automatic deletion of stock history (until Q-RET-1 is answered)", () => {
  it("no code deletes inventory log entries", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|mts|mjs)$/.test(f)) files.push(p);
      }
    };
    walk("src");
    walk("netlify");
    walk("scripts");
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /invlog/.test(src) && /\.delete\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
