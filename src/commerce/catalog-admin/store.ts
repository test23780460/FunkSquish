import { updateWithRetry, type KvStore } from "../../lib/storage/kv-core";
import { validateProducts, CatalogError } from "../validate";
import type { Product } from "../types";
import { newRecord, toPublicProduct, type ProductRecord } from "./record";
import { productReadiness, type ReadinessContext } from "./readiness";

/**
 * Dashboard product storage and the public catalog releases.
 *
 *  product/<id>       one ProductRecord (public + private fields)
 *  release/<000001>   an immutable public catalog: validated public products only
 *  release/current    which release the website shows
 *
 * The website never reads product records — only the current release, which
 * holds nothing private. A release changes only when the owner publishes,
 * unpublishes or rolls back ONE product at a time, so an unfinished edit to
 * one product can never go live with another.
 */
export const recordKey = (id: string) => `product/${id}`;
const releaseKey = (seq: number) => `release/${String(seq).padStart(6, "0")}`;
const CURRENT = "release/current";
export const KEEP_RELEASES = 50;
const HISTORY = 40;

export interface Release {
  seq: number;
  at: string;
  /** What changed, e.g. "Published Berry Burst". */
  change: string;
  basedOn: number | null;
  products: Product[];
}

export async function listRecords(store: KvStore): Promise<ProductRecord[]> {
  const keys = await store.list("product/");
  const rows = await Promise.all(keys.map(async (k) => ((await (store.getListed ?? store.get).call(store, k)) as { value: ProductRecord } | null)?.value));
  return rows.filter((r): r is ProductRecord => !!r).sort((a, b) => a.product.name.localeCompare(b.product.name));
}

export async function getRecord(store: KvStore, id: string): Promise<ProductRecord | null> {
  return (await store.get<ProductRecord>(recordKey(id)))?.value ?? null;
}

export type SaveResult = { ok: true; record: ProductRecord } | { ok: false; error: string; conflict?: boolean };

/** Slug/SKU clashes with other dashboard products and the build-time catalog. */
export function clashes(records: ProductRecord[], buildTime: Product[], self: ProductRecord): string[] {
  const out: string[] = [];
  const others = [...records.filter((r) => r.id !== self.id).map((r) => r.product), ...buildTime.filter((p) => p.id !== self.id)];
  if (others.some((p) => p.slug === self.product.slug)) out.push(`The web address "${self.product.slug}" is already used by another product.`);
  for (const v of self.product.variants) {
    const hit = others.find((p) => p.variants.some((x) => x.sku === v.sku));
    if (hit) out.push(`SKU ${v.sku} is already used by ${hit.name}.`);
  }
  return out;
}

export async function createRecord(store: KvStore, input: Parameters<typeof newRecord>[0], buildTime: Product[], now = new Date()): Promise<SaveResult> {
  const record = newRecord(input, now);
  const clash = clashes(await listRecords(store), buildTime, record);
  if (clash.length) return { ok: false, error: clash.join(" ") };
  if (!(await store.create(recordKey(record.id), record))) return { ok: false, error: "Couldn't create the product. Try again." };
  return { ok: true, record };
}

/**
 * Change a product, but only if nobody saved it since `expectedRev` (the
 * revision the form was loaded with). Bumps the revision and notes what changed.
 */
export async function saveRecord(
  store: KvStore,
  id: string,
  expectedRev: number,
  summary: string,
  fn: (r: ProductRecord) => { ok: true; record: ProductRecord } | { ok: false; error: string },
  check?: (r: ProductRecord) => string[],
  now = new Date(),
): Promise<SaveResult> {
  let out: SaveResult = { ok: false, error: "That product no longer exists." };
  await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => {
    if (!cur) return ((out = { ok: false, error: "That product no longer exists." }), undefined);
    if (cur.rev !== expectedRev)
      return ((out = { ok: false, conflict: true, error: "This product was changed somewhere else (another tab or device) since you opened it. Reload to see the latest, then make your change again." }), undefined);
    const r = fn(structuredClone(cur));
    if (!r.ok) return ((out = r), undefined);
    const problems = check?.(r.record) ?? [];
    if (problems.length) return ((out = { ok: false, error: problems.join(" ") }), undefined);
    const at = now.toISOString();
    const next: ProductRecord = { ...r.record, rev: cur.rev + 1, updatedAt: at, history: [{ at, summary }, ...cur.history].slice(0, HISTORY) };
    out = { ok: true, record: next };
    return next;
  });
  return out;
}

/** Only never-published drafts can be deleted (anything that was live is archived instead, so its history stays). */
export async function deleteDraft(store: KvStore, id: string, expectedRev: number): Promise<SaveResult> {
  const cur = await store.get<ProductRecord>(recordKey(id));
  if (!cur) return { ok: false, error: "That product no longer exists." };
  if (cur.value.rev !== expectedRev) return { ok: false, conflict: true, error: "This product changed since you opened it. Reload first." };
  if (cur.value.publishedAt) return { ok: false, error: "This product has been published before, so it can only be archived (its record stays for your history)." };
  await store.delete(recordKey(id));
  return { ok: true, record: cur.value };
}

/* --------------------------------- releases --------------------------------- */

export async function currentRelease(store: KvStore): Promise<Release | null> {
  const ptr = await store.get<{ seq: number }>(CURRENT);
  if (!ptr) return null;
  return (await store.get<Release>(releaseKey(ptr.value.seq)))?.value ?? null;
}

export async function getRelease(store: KvStore, seq: number): Promise<Release | null> {
  if (!Number.isSafeInteger(seq) || seq < 1) return null;
  return (await store.get<Release>(releaseKey(seq)))?.value ?? null;
}

export type ReleaseSummary = Omit<Release, "products"> & { count: number };

export async function listReleases(store: KvStore): Promise<ReleaseSummary[]> {
  const keys = (await store.list("release/")).filter((k) => k !== CURRENT).reverse();
  const out = await Promise.all(keys.map(async (k) => (await store.get<Release>(k))?.value));
  return out.filter((r): r is Release => !!r).map((r) => ({ seq: r.seq, at: r.at, change: r.change, basedOn: r.basedOn, count: r.products.length }));
}

export type ReleaseResult = { ok: true; release: Release } | { ok: false; error: string };

/**
 * Make a new release from the current one with `change` applied, validate it
 * exactly like the build-time catalog, then point the website at it.
 * Two publishes at the same moment can't both win: the release number is
 * claimed with create-only, and the pointer moves with compare-and-set.
 */
export async function makeRelease(store: KvStore, change: string, edit: (products: Product[]) => Product[], now = new Date()): Promise<ReleaseResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ptr = await store.get<{ seq: number }>(CURRENT);
    const base = ptr ? await store.get<Release>(releaseKey(ptr.value.seq)) : null;
    const products = edit(structuredClone(base?.value.products ?? []));
    try {
      validateProducts(products);
    } catch (e) {
      return { ok: false, error: e instanceof CatalogError ? e.message.replace("Invalid product catalog:", "The catalog wouldn't be valid:") : "The catalog wouldn't be valid." };
    }
    if (products.some((p) => p.publication !== "published")) return { ok: false, error: "Only published products can go in a release." };
    const seq = (ptr?.value.seq ?? 0) + 1;
    const release: Release = { seq, at: now.toISOString(), change: change.slice(0, 200), basedOn: ptr?.value.seq ?? null, products };
    if (!(await store.create(releaseKey(seq), release))) continue; // someone else just published: start over from theirs
    const moved = ptr ? await store.replace(CURRENT, { seq }, ptr.etag) : await store.create(CURRENT, { seq });
    if (!moved) {
      await store.delete(releaseKey(seq));
      continue;
    }
    await pruneReleases(store, seq);
    return { ok: true, release };
  }
  return { ok: false, error: "Too many changes at once. Try again in a moment." };
}

async function pruneReleases(store: KvStore, current: number) {
  const keys = (await store.list("release/")).filter((k) => k !== CURRENT).sort();
  const extra = keys.length - KEEP_RELEASES;
  for (const k of keys.slice(0, Math.max(0, extra))) if (k !== releaseKey(current)) await store.delete(k);
}

export type PublishResult = { ok: true; release: Release; record: ProductRecord } | { ok: false; error: string; missing?: string[] };

/** Put this product's current version on the website. Refused unless every readiness item passes. */
export async function publishProduct(store: KvStore, id: string, expectedRev: number, ctx: ReadinessContext, now = new Date()): Promise<PublishResult> {
  const rec = await getRecord(store, id);
  if (!rec) return { ok: false, error: "That product no longer exists." };
  if (rec.rev !== expectedRev) return { ok: false, error: "This product changed since you opened it. Reload, check it, then publish." };
  if (rec.status === "archived") return { ok: false, error: "Restore this product from the archive first." };
  const readiness = productReadiness(rec, ctx);
  if (!readiness.ready) return { ok: false, error: "This product isn't ready to publish yet.", missing: readiness.items.filter((i) => !i.ok).flatMap((i) => i.missing.map((m) => `${i.label}: ${m}`)) };
  const pub = toPublicProduct({ ...rec, status: "published" });
  const r = await makeRelease(store, `Published ${rec.product.name}`, (list) => [...list.filter((p) => p.id !== id), pub], now);
  if (!r.ok) return r;
  const saved = await saveRecord(store, id, rec.rev, `Published (catalog release ${r.release.seq})`, (x) => ({ ok: true, record: { ...x, status: "published", publishedRev: x.rev + 1, publishedAt: now.toISOString() } }), undefined, now);
  if (!saved.ok) return { ok: false, error: `The product went live (release ${r.release.seq}) but its record couldn't be updated: ${saved.error}` };
  return { ok: true, release: r.release, record: saved.record };
}

/** Take a product off the website (to draft, or to the archive). */
export async function unpublishProduct(store: KvStore, id: string, expectedRev: number, to: "draft" | "archived", now = new Date()): Promise<PublishResult> {
  const rec = await getRecord(store, id);
  if (!rec) return { ok: false, error: "That product no longer exists." };
  if (rec.rev !== expectedRev) return { ok: false, error: "This product changed since you opened it. Reload first." };
  const live = await currentRelease(store);
  let release = live;
  if (live?.products.some((p) => p.id === id)) {
    const r = await makeRelease(store, `${to === "archived" ? "Archived" : "Unpublished"} ${rec.product.name}`, (list) => list.filter((p) => p.id !== id), now);
    if (!r.ok) return r;
    release = r.release;
  }
  const saved = await saveRecord(store, id, rec.rev, to === "archived" ? "Archived" : "Moved back to draft", (x) => ({ ok: true, record: { ...x, status: to, publishedRev: null } }), undefined, now);
  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true, release: release ?? (await currentRelease(store))!, record: saved.record };
}

/** Show an earlier release again (as a NEW release, so history stays linear). Records follow: in the release → published, otherwise → draft. */
export async function rollbackTo(store: KvStore, seq: number, now = new Date()): Promise<ReleaseResult> {
  const old = await getRelease(store, seq);
  if (!old) return { ok: false, error: "That release no longer exists." };
  const r = await makeRelease(store, `Rolled back to release ${seq}`, () => structuredClone(old.products), now);
  if (!r.ok) return r;
  const live = new Set(old.products.map((p) => p.id));
  for (const rec of await listRecords(store)) {
    const want = live.has(rec.id) ? "published" : rec.status === "archived" ? "archived" : "draft";
    if (rec.status !== want) await saveRecord(store, rec.id, rec.rev, `Rollback to release ${seq}: now ${want}`, (x) => ({ ok: true, record: { ...x, status: want } }), undefined, now);
  }
  return r;
}

/** Does the live version differ from the record (edits not published yet)? */
export function liveDiffers(rec: ProductRecord, live: Release | null): boolean {
  const onSite = live?.products.find((p) => p.id === rec.id);
  if (!onSite) return false;
  return JSON.stringify(onSite) !== JSON.stringify(toPublicProduct({ ...rec, status: "published" }));
}
