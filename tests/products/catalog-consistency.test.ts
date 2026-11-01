import { describe, expect, it } from "vitest";
import { MemoryKvStore, type KvStore, type Versioned } from "@/lib/storage/kv-core";
import { toPublicProduct, type ProductRecord } from "@/commerce/catalog-admin/record";
import {
  PENDING_STALE_MS,
  currentRelease,
  deleteDraft,
  getRecord,
  listRecords,
  publishProduct,
  recordKey,
  saveRecord,
  unpublishProduct,
} from "@/commerce/catalog-admin/store";
import { completeRecord, ctx } from "./fixtures";

/**
 * Review finding 1 (PR #27): publish/delete consistency under concurrency and
 * storage failures. A store wrapper lets each test run a second "tab" at an
 * exact point inside the first action, or make one storage call fail.
 */
type Op = "get" | "create" | "replace" | "delete";
type Hook = { op: Op; key: (k: string) => boolean; nth?: number; run?: () => Promise<void>; fail?: boolean };

class ScriptedStore implements KvStore {
  readonly durable = false;
  private seen = new Map<Hook, number>();
  constructor(
    readonly inner = new MemoryKvStore(),
    public hooks: Hook[] = [],
  ) {}
  private async before(op: Op, key: string) {
    for (const h of this.hooks) {
      if (h.op !== op || !h.key(key)) continue;
      const n = (this.seen.get(h) ?? 0) + 1;
      this.seen.set(h, n);
      if (n !== (h.nth ?? 1)) continue;
      if (h.run) {
        const run = h.run;
        h.run = undefined; // once
        await run();
      }
      if (h.fail) throw new Error(`injected ${op} failure on ${key}`);
    }
  }
  async get<T>(k: string): Promise<Versioned<T> | null> {
    await this.before("get", k);
    return this.inner.get<T>(k);
  }
  async create<T>(k: string, v: T) {
    await this.before("create", k);
    return this.inner.create(k, v);
  }
  async replace<T>(k: string, v: T, e: string) {
    await this.before("replace", k);
    return this.inner.replace(k, v, e);
  }
  async delete(k: string) {
    await this.before("delete", k);
    return this.inner.delete(k);
  }
  list(p: string) {
    return this.inner.list(p);
  }
}

const NOW = new Date("2026-11-01T15:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const isProduct = (id: string) => (k: string) => k === recordKey(id);
const isRelease = (k: string) => k.startsWith("release/0");
const isPointer = (k: string) => k === "release/current";

async function setup(published = false) {
  const store = new ScriptedStore();
  const rec = completeRecord();
  await store.inner.create(recordKey(rec.id), rec);
  if (published) {
    const r = await publishProduct(store, rec.id, rec.rev, ctx(), NOW);
    if (!r.ok) throw new Error(r.error);
  }
  return { store, id: rec.id };
}
const raw = async (s: ScriptedStore, id: string) => (await s.inner.get<ProductRecord>(recordKey(id)))?.value ?? null;
const live = async (s: KvStore, id: string) => !!(await currentRelease(s))?.products.some((p) => p.id === id);

/** The invariant the review asks for: a product is live exactly when its record says published, and a deleted record is never live. */
async function consistent(s: ScriptedStore, id: string, now = later(PENDING_STALE_MS + 1000)) {
  const rec = await getRecord(s, id, now); // also resolves interrupted changes
  const onSite = await live(s, id);
  if (!rec) return !onSite;
  return onSite === (rec.status === "published");
}

describe("delete vs publish/save in two tabs", () => {
  it("tab B publishes after tab A read the draft but before A deletes: the delete is refused, the product stays live with its record", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    // Inside deleteDraft, right before its compare-and-set on the record, tab B publishes.
    store.hooks = [{ op: "replace", key: isProduct(id), run: async () => void (await publishProduct(store.inner, id, rev, ctx(), NOW)) }];
    const del = await deleteDraft(store, id, rev, NOW);
    expect(del.ok).toBe(false);
    expect(await raw(store, id)).not.toBeNull();
    expect(await live(store, id)).toBe(true);
    expect(await consistent(store, id)).toBe(true);
  });

  it("tab B saves an edit at the same moment: the delete is refused (changed elsewhere)", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "replace", key: isProduct(id), run: async () => void (await saveRecord(store.inner, id, rev, "edit", (r) => ({ ok: true, record: r }), undefined, NOW)) }];
    const del = await deleteDraft(store, id, rev, NOW);
    expect(del).toMatchObject({ ok: false, conflict: true });
    expect(await raw(store, id)).not.toBeNull();
  });

  it("tab A's delete lands first: tab B's publish and save both see it's gone and change nothing", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    // Delete gets as far as the tombstone, then its final removal is slow; meanwhile B tries to publish and save.
    let pub: Awaited<ReturnType<typeof publishProduct>> | null = null;
    let save: Awaited<ReturnType<typeof saveRecord>> | null = null;
    store.hooks = [
      {
        op: "delete",
        key: isProduct(id),
        run: async () => {
          pub = await publishProduct(store.inner, id, rev, ctx(), NOW);
          save = await saveRecord(store.inner, id, rev, "edit", (r) => ({ ok: true, record: r }), undefined, NOW);
        },
      },
    ];
    expect((await deleteDraft(store, id, rev, NOW)).ok).toBe(true);
    expect(pub).toMatchObject({ ok: false });
    expect(save).toMatchObject({ ok: false });
    expect(await live(store, id)).toBe(false);
    expect(await getRecord(store, id, NOW)).toBeNull();
  });

  it("a delete whose final removal fails leaves an invisible tombstone that nothing can revive", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "delete", key: isProduct(id), fail: true }];
    expect((await deleteDraft(store, id, rev, NOW)).ok).toBe(true);
    expect((await raw(store, id))?.deletedAt).toBeTruthy(); // still stored, as a tombstone
    expect(await getRecord(store, id, NOW)).toBeNull();
    expect((await listRecords(store, NOW)).map((r) => r.id)).not.toContain(id);
    expect((await publishProduct(store, id, rev + 1, ctx(), NOW)).ok).toBe(false);
    expect((await saveRecord(store, id, rev + 1, "edit", (r) => ({ ok: true, record: r }), undefined, NOW)).ok).toBe(false);
    expect(await store.inner.create(recordKey(id), completeRecord())).toBe(false); // the id can't be reused over it
  });

  it("a draft can't be deleted while a publish of it is running", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    let del: Awaited<ReturnType<typeof deleteDraft>> | null = null;
    // Pause the publish just before it writes the new catalog release; tab B deletes.
    store.hooks = [{ op: "create", key: isRelease, run: async () => void (del = await deleteDraft(store.inner, id, rev, NOW)) }];
    expect((await publishProduct(store, id, rev, ctx(), NOW)).ok).toBe(true);
    expect(del).toMatchObject({ ok: false });
    expect(await live(store, id)).toBe(true);
    expect((await raw(store, id))?.status).toBe("published");
  });
});

describe("publish/unpublish interrupted by a storage failure", () => {
  it("catalog write fails: nothing goes live, the intent is cleared, and the owner can simply try again", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "create", key: isRelease, fail: true }];
    const r = await publishProduct(store, id, rev, ctx(), NOW);
    expect(r.ok).toBe(false);
    expect(await live(store, id)).toBe(false);
    expect((await raw(store, id))?.pending ?? null).toBeNull();
    expect((await raw(store, id))?.rev).toBe(rev); // no reload needed to retry
    store.hooks = [];
    expect((await publishProduct(store, id, rev, ctx(), NOW)).ok).toBe(true);
  });

  it("the record update after going live fails: the owner is told it's live, and the record catches up automatically", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    // 1st replace on the record = claiming the intent; fail the 2nd (finishing it).
    store.hooks = [{ op: "replace", key: isProduct(id), nth: 2, fail: true }];
    const r = await publishProduct(store, id, rev, ctx(), NOW);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/went live .* automatically/) });
    expect(await live(store, id)).toBe(true);
    expect((await raw(store, id))?.pending?.op).toBe("publish");
    store.hooks = [];
    // Edits and deletes wait while it's pending (not yet stale).
    expect((await saveRecord(store, id, rev, "edit", (x) => ({ ok: true, record: x }), undefined, later(1000))).ok).toBe(false);
    // Once stale, the next read finishes it from what the website shows.
    const rec = await getRecord(store, id, later(PENDING_STALE_MS + 1));
    expect(rec).toMatchObject({ status: "published", pending: null });
    expect(rec?.publishedRev).toBe(rec?.rev);
    expect(await consistent(store, id)).toBe(true);
  });

  it("the server stops after claiming but before the catalog changes: the intent is undone, nothing is live", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "get", key: isPointer, fail: true }]; // dies inside makeRelease's first read
    expect((await publishProduct(store, id, rev, ctx(), NOW)).ok).toBe(false);
    store.hooks = [];
    // Simulate the worst case: the intent survived (e.g. the undo also failed).
    await store.inner.replace(recordKey(id), { ...(await raw(store, id))!, pending: { op: "publish", token: "t-crashed", at: NOW.toISOString(), hash: "x" } }, (await store.inner.get(recordKey(id)))!.etag);
    expect((await listRecords(store, later(PENDING_STALE_MS + 1))).find((r) => r.id === id)).toMatchObject({ status: "draft", pending: null });
    expect(await live(store, id)).toBe(false);
  });

  it("re-publishing an edit that never reached the website doesn't mark the edit as live", async () => {
    const { store, id } = await setup(true);
    let rec = (await raw(store, id))!;
    const edited = await saveRecord(store, id, rec.rev, "rename", (x) => ({ ok: true, record: { ...x, product: { ...x.product, name: "Renamed Squishy" } } }), undefined, NOW);
    if (!edited.ok) throw new Error(edited.error);
    rec = edited.record;
    const before = (await currentRelease(store))!.products.find((p) => p.id === id)!;
    // Leave a stale publish intent for the edit, but the catalog still shows the old version.
    await store.inner.replace(recordKey(id), { ...rec, pending: { op: "publish", token: "t", at: NOW.toISOString(), hash: "hash-of-the-edit" } }, (await store.inner.get(recordKey(id)))!.etag);
    const after = await getRecord(store, id, later(PENDING_STALE_MS + 1));
    expect(after?.pending).toBeNull();
    expect(after?.publishedRev).not.toBe(after?.rev); // still "edits not published"
    expect(before.name).not.toBe("Renamed Squishy");
  });

  it("unpublish: catalog change fails → stays live and published; record update fails → catches up as unpublished", async () => {
    const { store, id } = await setup(true);
    let rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "create", key: isRelease, fail: true }];
    expect((await unpublishProduct(store, id, rev, "archived", NOW)).ok).toBe(false);
    expect(await live(store, id)).toBe(true);
    expect((await raw(store, id))).toMatchObject({ status: "published", pending: null });

    rev = (await raw(store, id))!.rev;
    store.hooks = [{ op: "replace", key: isProduct(id), nth: 2, fail: true }];
    expect((await unpublishProduct(store, id, rev, "archived", NOW)).ok).toBe(false);
    expect(await live(store, id)).toBe(false);
    store.hooks = [];
    expect(await getRecord(store, id, later(PENDING_STALE_MS + 1))).toMatchObject({ status: "archived", pending: null, publishedRev: null });
  });

  it("two tabs publishing the same product at once: one wins, the other is told to wait, and the state is consistent", async () => {
    const { store, id } = await setup();
    const rev = (await raw(store, id))!.rev;
    let second: Awaited<ReturnType<typeof publishProduct>> | null = null;
    store.hooks = [{ op: "create", key: isRelease, run: async () => void (second = await publishProduct(store.inner, id, rev, ctx(), NOW)) }];
    expect((await publishProduct(store, id, rev, ctx(), NOW)).ok).toBe(true);
    expect(second).toMatchObject({ ok: false });
    expect(await consistent(store, id)).toBe(true);
    expect((await currentRelease(store))!.products.filter((p) => p.id === id)).toHaveLength(1);
  });

  it("the live product matches the record's published version", async () => {
    const { store, id } = await setup(true);
    const rec = (await getRecord(store, id, NOW))!;
    const onSite = (await currentRelease(store))!.products.find((p) => p.id === id);
    expect(onSite).toEqual(toPublicProduct({ ...rec, status: "published" }));
  });
});
