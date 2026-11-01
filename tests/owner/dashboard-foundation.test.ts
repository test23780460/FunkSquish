import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryKvStore } from "@/lib/storage/kv-core";
import { appendAudit, listAudit, pruneAudit, scrubAuditText } from "@/lib/owner/data";
import { applyRestore, exportOwnerData, planRestore, type OwnerBackup } from "@/lib/owner/backup";
import { fulfillmentQueue, queueFor } from "@/commerce/orders/fulfillment-queue";
import { order } from "./factory";

describe("audit log", () => {
  it("masks email addresses and long numbers, and trims", () => {
    expect(scrubAuditText("Emailed fictional.buyer@example.com about 4242424242424242   ok")).toBe("Emailed [email] about [number] ok");
    expect(scrubAuditText("x".repeat(400))).toHaveLength(300);
  });

  it("appends without overwriting, lists newest first, filters by area", async () => {
    const s = new MemoryKvStore();
    const now = new Date("2026-11-02T12:00:00Z");
    await appendAudit(s, { area: "products", action: "create", target: "p1", summary: "Created p1", at: "2026-11-01T10:00:00.000Z" });
    await appendAudit(s, { area: "suppliers", action: "create", target: "s1", summary: "Created s1", at: "2026-11-02T09:00:00.000Z" });
    await appendAudit(s, { area: "products", action: "edit", target: "p1", summary: "Edited p1", at: "2026-11-02T10:00:00.000Z" });
    const all = await listAudit(s, { now });
    expect(all.map((e) => e.summary)).toEqual(["Edited p1", "Created s1", "Created p1"]);
    expect((await listAudit(s, { now, area: "products" })).map((e) => e.action)).toEqual(["edit", "create"]);
    expect(await listAudit(s, { now, limit: 1 })).toHaveLength(1);
  });

  it("prunes only entries older than the cutoff", async () => {
    const s = new MemoryKvStore();
    await appendAudit(s, { area: "settings", action: "old", target: null, summary: "old", at: "2023-01-01T00:00:00.000Z" });
    await appendAudit(s, { area: "settings", action: "new", target: null, summary: "new", at: "2026-10-01T00:00:00.000Z" });
    expect(await pruneAudit(s, 730, new Date("2026-11-01T00:00:00Z"))).toBe(1);
    expect((await s.list("audit/")).length).toBe(1);
  });
});

describe("dashboard backup and restore", () => {
  async function seeded() {
    const s = new MemoryKvStore();
    await s.create("product/p1", { id: "p1", name: "Fictional squishy" });
    await s.create("supplier/s1", { id: "s1", name: "Mock Supplier Co" });
    await s.create("owner/rate-limit-ish", { n: 1 }); // not a dashboard prefix: never exported
    return s;
  }

  it("exports dashboard records only, labeled with where they came from", async () => {
    const b = await exportOwnerData(await seeded(), "local", new Date("2026-11-01T00:00:00Z"));
    expect(Object.keys(b.records).sort()).toEqual(["product/p1", "supplier/s1"]);
    expect(b.environment).toBe("local");
  });

  it("refuses a backup from another environment, or with unexpected records", async () => {
    const s = await seeded();
    const b = await exportOwnerData(s, "preview");
    expect(await planRestore(s, b, "production")).toMatchObject({ ok: false });
    expect(await planRestore(s, { ...b, environment: "production", records: { "../etc/passwd": 1 } }, "production")).toMatchObject({ ok: false });
    expect(await planRestore(s, { ...b, environment: "production", records: { "partner-app/x": 1 } }, "production")).toMatchObject({ ok: false });
    expect(await planRestore(s, { hello: "world" }, "production")).toMatchObject({ ok: false });
  });

  it("adds missing records, replaces changed ones only when asked, never deletes", async () => {
    const s = await seeded();
    const b: OwnerBackup = await exportOwnerData(s, "local");
    // Since the backup: p1 changed, s1 deleted, p2 added.
    const p1 = await s.get("product/p1");
    await s.replace("product/p1", { id: "p1", name: "Renamed" }, p1!.etag);
    await s.delete("supplier/s1");
    await s.create("product/p2", { id: "p2" });
    const plan = await planRestore(s, b, "local");
    if (!plan.ok) throw new Error(plan.error);
    expect(plan).toMatchObject({ add: ["supplier/s1"], differ: ["product/p1"] });
    expect(await applyRestore(s, b, plan, false)).toEqual({ added: 1, replaced: 0 });
    expect((await s.get<{ name: string }>("product/p1"))!.value.name).toBe("Renamed");
    const again = await planRestore(s, b, "local");
    if (!again.ok) throw new Error(again.error);
    expect(await applyRestore(s, b, again, true)).toEqual({ added: 0, replaced: 1 });
    expect((await s.get<{ name: string }>("product/p1"))!.value.name).toBe("Fictional squishy");
    expect(await s.get("product/p2")).not.toBeNull(); // never deleted
  });
});

describe("fulfillment queues", () => {
  it("sorts packages by what has to happen next", () => {
    const o = order({}, [{ id: "a" }, { id: "b", source: "supplier", status: "awaiting_supplier" }, { id: "c", source: "supplier", status: "sent_to_supplier" }, { id: "d", status: "shipped" }, { id: "e", status: "lost" }, { id: "f", status: "lost", resolution: "reshipped" }]);
    expect(o.fulfillments.map((g) => queueFor(o, g))).toEqual(["ours", "supplier", "sent", "transit", "problems", "done"]);
  });

  it("never lists packages of canceled or unpaid orders as work to do", () => {
    expect(queueFor(order({ status: "canceled" }), order().fulfillments[0])).toBe("done");
    const unpaid = order({ paymentStatus: "processing", status: "awaiting_payment" });
    expect(queueFor(unpaid, unpaid.fulfillments[0])).toBe("done");
  });

  it("puts the soonest ship-by first", () => {
    const q = fulfillmentQueue([order({ id: "FS-T-1" }, [{ shipBy: "2026-11-09" }]), order({ id: "FS-T-2" }, [{ shipBy: "2026-11-03" }]), order({ id: "FS-T-3" }, [{ shipBy: null }])]);
    expect(q.ours.map((r) => r.order.id)).toEqual(["FS-T-2", "FS-T-1", "FS-T-3"]);
  });
});
