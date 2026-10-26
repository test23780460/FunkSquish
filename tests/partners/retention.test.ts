import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryKvStore, type KvStore } from "@/lib/storage/kv-core";
import { RETENTION, addMonths, lastActivity, rateLimitExpired, rateLimitKey, rateLimitWindowStart, retentionDecision } from "@/lib/partners/retention";
import { RUN_LAST, RUN_LAST_SUCCESS, lastRuns, recordRun, runRetention, summarize, type CleanupStores } from "@/lib/partners/cleanup";
import { deletionRecordExpired, deletionState, type DeletionRequest } from "@/lib/partners/deletion";
import { alertReasons, sendOpsAlert } from "@/lib/partners/ops-alert";
import type { PartnerApplication } from "@/lib/partners/types";

const T0 = "2025-01-31T10:00:00.000Z";

function app(over: Partial<PartnerApplication> = {}): PartnerApplication {
  return {
    id: "FS-P-20250131-ABCDEFGH",
    createdAt: T0,
    updatedAt: T0,
    type: "manufacturer",
    status: "new",
    fields: { business: "Squish Co", email: "pat@squish.co" },
    consent: { version: "v", at: T0 },
    audit: { ipHash: "h" },
    notification: { status: "sent", at: T0 },
    notes: [],
    history: [{ at: T0, from: null, to: "new" }],
    ...over,
  };
}
const ms = (d: Date, delta: number) => new Date(d.getTime() + delta);
const stores = (): CleanupStores => ({ apps: new MemoryKvStore(), limits: new MemoryKvStore(), ops: new MemoryKvStore() });

describe("retention rules", () => {
  it("adds calendar months safely", () => {
    expect(addMonths(new Date("2025-01-31T10:00:00Z"), 1).toISOString()).toBe("2025-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2027-01-31T00:00:00Z"), 13).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addMonths(new Date("2025-12-15T00:00:00Z"), 24).toISOString()).toBe("2027-12-15T00:00:00.000Z");
  });

  it("measures meaningful activity only — not updatedAt or notification resends", () => {
    const a = app({ updatedAt: "2026-10-01T00:00:00Z", notification: { status: "sent", at: "2026-10-01T00:00:00Z" } });
    expect(lastActivity(a).toISOString()).toBe(T0);
    expect(lastActivity(app({ notes: [{ at: "2025-06-01T00:00:00Z", text: "called them" }] })).toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(lastActivity(app({ history: [{ at: T0, from: null, to: "new" }, { at: "2025-03-01T00:00:00Z", from: "new", to: "under-review" }] })).toISOString()).toBe("2025-03-01T00:00:00.000Z");
    expect(lastActivity(app({ relationshipConfirmedAt: "2025-09-09T00:00:00Z" })).toISOString()).toBe("2025-09-09T00:00:00.000Z");
  });

  const cases: [string, Partial<PartnerApplication>, number][] = [
    ["declined", { status: "declined" }, 12],
    ["new", { status: "new" }, 24],
    ["under review", { status: "under-review" }, 24],
    ["need more info", { status: "need-info" }, 24],
    ["future reseller interest", { type: "reseller", status: "new" }, 24],
    ["declined reseller", { type: "reseller", status: "declined" }, 12],
  ];
  for (const [name, over, months] of cases) {
    it(`${name}: kept until exactly ${months} months after the last activity, then deleted`, () => {
      const a = app(over);
      const due = addMonths(new Date(T0), months);
      expect(retentionDecision(a, ms(due, -1)).action).toBe("keep");
      expect(retentionDecision(a, due).action).toBe("delete");
      expect(retentionDecision(a, ms(due, 86_400_000)).action).toBe("delete");
    });
  }

  it("declined uses the decline date, not the submission date", () => {
    const declinedAt = "2025-08-01T00:00:00Z";
    const a = app({ status: "declined", history: [{ at: T0, from: null, to: "new" }, { at: declinedAt, from: "new", to: "declined" }] });
    expect(retentionDecision(a, new Date("2026-07-31T00:00:00Z")).action).toBe("keep");
    expect(retentionDecision(a, new Date("2026-08-01T00:00:00Z")).action).toBe("delete");
  });

  it("an inactive application isn't saved by bookkeeping updates", () => {
    const a = app({ updatedAt: "2026-12-01T00:00:00Z", notification: { status: "sent", at: "2026-12-01T00:00:00Z" } });
    expect(retentionDecision(a, new Date("2027-02-01T00:00:00Z")).action).toBe("delete");
  });

  it("approved partners are never deleted automatically; their yearly review comes due", () => {
    const a = app({ status: "approved" });
    const reviewAt = addMonths(new Date(T0), RETENTION.approvedReviewMonths);
    expect(retentionDecision(a, ms(reviewAt, -1))).toMatchObject({ action: "review", overdue: false });
    expect(retentionDecision(a, new Date("2035-01-01"))).toMatchObject({ action: "review", overdue: true });
    const confirmed = app({ status: "approved", relationshipConfirmedAt: "2026-01-01T00:00:00Z" });
    expect(retentionDecision(confirmed, new Date("2026-06-01"))).toMatchObject({ action: "review", overdue: false });
  });

  it("a legal hold overrides deletion and doesn't restart the clock", () => {
    const held = app({ status: "declined", legalHold: { reason: "Dispute — keep until resolved", at: "2026-10-01T00:00:00Z" } });
    expect(retentionDecision(held, new Date("2030-01-01")).action).toBe("hold");
    expect(lastActivity(held).toISOString()).toBe(T0);
  });

  it("rate-limit counters expire 2 days after their window started", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const key = rateLimitKey("ip-hour/abc", 3600, now);
    expect(key).toMatch(/^ip-hour\/abc\/w3600\/\d+$/);
    const start = rateLimitWindowStart(key)!;
    expect(rateLimitExpired(key, ms(start, 48 * 3_600_000 - 1))).toBe(false);
    expect(rateLimitExpired(key, ms(start, 48 * 3_600_000))).toBe(true);
    // Counters written before the window was in the key are still understood.
    const legacyDay = Math.floor(now / 86_400_000);
    expect(rateLimitWindowStart(`global-day/${legacyDay}`)?.getTime()).toBe(legacyDay * 86_400_000);
    expect(rateLimitWindowStart(`email-day/xyz/${legacyDay}`)?.getTime()).toBe(legacyDay * 86_400_000);
    // Anything unrecognised in the rate-limit store is just a count, so it's removed.
    expect(rateLimitExpired("something-else", new Date(now))).toBe(true);
  });
});

async function seed(s: CleanupStores, apps: PartnerApplication[]) {
  for (const a of apps) await s.apps.create(`app/${a.id}`, a);
}
const id = (n: number) => `FS-P-20250131-AAAAAA${String.fromCharCode(65 + n)}${String.fromCharCode(65 + n)}`;

describe("cleanup runs", () => {
  const now = new Date("2027-03-01T00:00:00Z");
  const mix = () => [
    app({ id: id(0), status: "declined" }), // due (12 months)
    app({ id: id(1), status: "new" }), // due (24 months from Jan 2025 = Jan 2027)
    app({ id: id(2), status: "new", createdAt: "2026-01-01T00:00:00Z", history: [{ at: "2026-01-01T00:00:00Z", from: null, to: "new" }] }), // keep
    app({ id: id(3), status: "approved" }), // never auto-deleted
    app({ id: id(4), status: "declined", legalHold: { reason: "Dispute", at: T0 } }), // held
  ];

  it("deletes exactly the expired records and counts the rest", async () => {
    const s = stores();
    await seed(s, mix());
    const nowMs = now.getTime();
    await s.limits.create(rateLimitKey("ip-hour/abc", 3600, nowMs - 3 * 86_400_000), { n: 1 });
    await s.limits.create(rateLimitKey("ip-hour/abc", 3600, nowMs), { n: 1 });
    const r = await runRetention(s, { now, trigger: "test" });
    expect(r.status).toBe("ok");
    expect(r.applications).toMatchObject({ checked: 5, due: 2, deleted: 2, held: 1, reviewOverdue: 1, failed: 0 });
    expect(r.rateLimits).toMatchObject({ checked: 2, deleted: 1 });
    expect((await s.apps.list("app/")).sort()).toEqual([`app/${id(2)}`, `app/${id(3)}`, `app/${id(4)}`]);
    expect(await s.limits.list("")).toHaveLength(1);
  });

  it("is safe to repeat", async () => {
    const s = stores();
    await seed(s, mix());
    await runRetention(s, { now });
    const second = await runRetention(s, { now });
    expect(second.applications.deleted).toBe(0);
    expect(second.status).toBe("ok");
  });

  it("dry run reports but deletes nothing, and never counts as a successful cleanup", async () => {
    const s = stores();
    await seed(s, mix());
    const r = await runRetention(s, { now, dryRun: true });
    expect(r.applications).toMatchObject({ due: 2, deleted: 0 });
    expect(r.dueRefs.sort()).toEqual([id(0), id(1)]);
    expect(await s.apps.list("app/")).toHaveLength(5);
    await recordRun(s.ops, r);
    const runs = await lastRuns(s.ops);
    expect(runs.last?.dryRun).toBe(true);
    expect(runs.lastSuccessAt).toBeNull();
    expect(JSON.stringify(await s.ops.get(RUN_LAST))).not.toContain(id(0)); // references aren't stored
  });

  it("keeps a record the owner changed while the run was in progress", async () => {
    const s = stores();
    await seed(s, [app({ id: id(0), status: "declined" })]);
    let reads = 0;
    const apps: KvStore = {
      ...s.apps,
      durable: false,
      list: (p) => s.apps.list(p),
      create: (k, v) => s.apps.create(k, v),
      replace: (k, v, e) => s.apps.replace(k, v, e),
      delete: (k) => s.apps.delete(k),
      get: async <T,>(k: string) => {
        const v = await s.apps.get<PartnerApplication>(k);
        // Second read (the re-check) sees a fresh note from the owner.
        if (v && ++reads === 2) return { ...v, value: { ...v.value, notes: [{ at: now.toISOString(), text: "Talking again" }] } as unknown as T };
        return v as unknown as { value: T; etag: string } | null;
      },
    };
    const r = await runRetention({ ...s, apps }, { now });
    expect(r.applications.deleted).toBe(0);
    expect(await s.apps.list("app/")).toHaveLength(1);
  });

  it("carries on after failures and reports them without personal details", async () => {
    const s = stores();
    await seed(s, mix());
    const brokenLimits: KvStore = { ...s.limits, durable: false, get: s.limits.get, create: s.limits.create, replace: s.limits.replace, delete: s.limits.delete, list: async () => { throw Object.assign(new Error("boom pat@squish.co"), { name: "StorageTimeoutError" }); } };
    let n = 0;
    const flakyApps: KvStore = {
      durable: false,
      list: (p) => s.apps.list(p),
      get: (k) => s.apps.get(k),
      create: (k, v) => s.apps.create(k, v),
      replace: (k, v, e) => s.apps.replace(k, v, e),
      delete: async (k) => {
        if (n++ === 0) throw Object.assign(new Error("x"), { name: "BlobsInternalError" });
        return s.apps.delete(k);
      },
    };
    const r = await runRetention({ apps: flakyApps, limits: brokenLimits, ops: s.ops }, { now });
    expect(r.status).toBe("failed");
    expect(r.applications).toMatchObject({ due: 2, deleted: 1, failed: 1 });
    expect(r.errors).toEqual(["applications:item:BlobsInternalError", "rate-limits:list:StorageTimeoutError"]);
    expect(summarize(r)).not.toMatch(/@|Squish|FS-P-/);
    // The next run picks up what failed.
    const retry = await runRetention(s, { now });
    expect(retry.applications.deleted).toBe(1);
  });

  it("records successful runs and keeps only the last 30 reports", async () => {
    const s = stores();
    for (let i = 0; i < 33; i++) {
      const r = await runRetention(s, { now });
      r.startedAt = new Date(Date.UTC(2027, 0, 1, 0, i)).toISOString();
      await recordRun(s.ops, r);
    }
    expect(await s.ops.list("run/history/")).toHaveLength(RETENTION.runHistory);
    expect((await s.ops.get(RUN_LAST_SUCCESS))?.value).toBeTruthy();
  });
});

describe("deletion requests", () => {
  const req = (over: Partial<DeletionRequest> = {}): DeletionRequest => ({
    id: "FS-D-20261001-ABCDEF",
    receivedAt: "2026-10-01T12:00:00.000Z",
    dueAt: "2026-10-31T12:00:00.000Z",
    status: "open",
    requesterHash: "h",
    matchedIds: [],
    log: [],
    ...over,
  });

  it("tracks the 30-day deadline", () => {
    expect(deletionState(req(), new Date("2026-10-10"))).toBe("open");
    expect(deletionState(req(), new Date("2026-10-25"))).toBe("due-soon");
    expect(deletionState(req(), new Date("2026-10-31T12:00:00Z"))).toBe("overdue");
    expect(deletionState(req({ status: "completed" }), new Date("2027-01-01"))).toBe("completed");
  });

  it("purges completed records after 24 months, never open requests or exceptions", async () => {
    const s = stores();
    const done = req({ id: "FS-D-20261001-AAAAAA", status: "completed", completedAt: "2026-10-05T00:00:00Z" });
    await s.ops.create(`deletion/${done.id}`, done);
    await s.ops.create("deletion/FS-D-20261001-BBBBBB", req({ id: "FS-D-20261001-BBBBBB", status: "exception", exceptionReason: "legal" }));
    await s.ops.create("deletion/FS-D-20261001-CCCCCC", req({ id: "FS-D-20261001-CCCCCC" }));
    expect(deletionRecordExpired(done, new Date("2028-10-04"))).toBe(false);
    const r = await runRetention(s, { now: new Date("2028-10-05T00:00:00Z") });
    expect(r.deletionRequests).toMatchObject({ open: 1, overdue: 1, exceptions: 1, recordsPurged: 1 });
    expect(await s.ops.list("deletion/")).toHaveLength(2);
  });
});

describe("owner alerts", () => {
  afterEach(() => vi.unstubAllGlobals());
  const base = async () => runRetention(stores(), { now: new Date("2026-10-27T08:00:00Z") });

  it("only emails when something needs attention, with counts only", async () => {
    const ok = await base();
    expect(alertReasons(ok)).toEqual([]);
    const bad = { ...ok, status: "partial" as const, errors: ["applications:item:BlobsInternalError"], deletionRequests: { ...ok.deletionRequests, overdue: 1 } };
    expect(alertReasons(bad)).toHaveLength(2);
    expect(await sendOpsAlert(bad, {}, "https://x")).toBe("not-configured");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendOpsAlert(bad, { PARTNER_NOTIFY_EMAIL: "o@x.co", PARTNER_NOTIFY_FROM: "w@x.co", BREVO_API_KEY: "k" }, "https://funksquish.com/partners/review")).toBe("sent");
    const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("past their 30-day deadline");
    expect(body).not.toMatch(/FS-P-|pat@/);
  });
});

describe("scheduled function", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../src/lib/storage/kv-core");
    vi.unstubAllEnvs();
  });

  it("runs daily on the production stores, honours dry-run and logs counts only", async () => {
    const created: Record<string, MemoryKvStore> = {};
    vi.doMock("../../src/lib/storage/kv-core", async (orig) => ({
      ...(await orig<typeof import("@/lib/storage/kv-core")>()),
      createBlobsKvStore: async (name: string) => (created[name] ??= new MemoryKvStore()),
    }));
    const fn = await import("../../netlify/functions/partner-retention.mjs");
    expect(fn.config.schedule).toBe("0 8 * * *");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const old = app({ status: "declined", history: [{ at: "2020-01-01T00:00:00Z", from: null, to: "declined" }], createdAt: "2020-01-01T00:00:00Z" });

    // Dry run first: nothing deleted.
    vi.stubEnv("PARTNER_RETENTION_DRY_RUN", "true");
    created["partner-applications"] = new MemoryKvStore();
    await created["partner-applications"].create(`app/${old.id}`, old);
    expect((await fn.default()).status).toBe(200);
    expect(await created["partner-applications"].list("app/")).toHaveLength(1);

    vi.stubEnv("PARTNER_RETENTION_DRY_RUN", "false");
    expect((await fn.default()).status).toBe(200);
    expect(await created["partner-applications"].list("app/")).toHaveLength(0);
    expect(Object.keys(created).sort()).toEqual(["partner-applications", "partner-ops", "partner-rate-limits"]);
    const lines = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(lines).toMatch(/retention ok: applications checked=1 due=1 deleted=1/);
    expect(lines).not.toMatch(/FS-P-|@|Squish/);
    log.mockRestore();
  });
});
