import { createHash, randomUUID } from "node:crypto";
import { updateWithRetry, type KvStore } from "../../lib/storage/kv-core";
import { validateProducts, CatalogError } from "../validate";
import type { Product } from "../types";
import { newRecord, toPublicProduct, type PendingChange, type ProductRecord } from "./record";
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
 *
 * Consistency between a record and the live catalog (review finding, PR #27):
 *  - Every record write is compare-and-set. Deleting a draft first replaces it
 *    with a tombstone by compare-and-set, so a publish or save racing with the
 *    delete either wins before it (and the delete is refused) or sees the
 *    tombstone (and is refused) — never "deleted record, product still live".
 *  - Publish/unpublish record their intent on the record (compare-and-set)
 *    BEFORE touching the public catalog, then finish the record afterwards.
 *    While the intent is there, saves and deletes are refused. If the action is
 *    interrupted (timeout, storage error), the intent is resolved from what the
 *    live catalog really shows once it's older than PENDING_STALE_MS: finished
 *    if the change is live, undone if not. The owner page is never left saying
 *    "not published" for a live product, or the reverse.
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

/** An interrupted publish/unpublish is resolved once its intent is this old (well past any request's time limit). */
export const PENDING_STALE_MS = 2 * 60_000;
const isStale = (p: PendingChange | null | undefined, now: Date) => !!p && now.getTime() - Date.parse(p.at) >= PENDING_STALE_MS;
export const publicHash = (p: Product) => createHash("sha256").update(JSON.stringify(p)).digest("hex").slice(0, 24);

async function readAll(store: KvStore): Promise<ProductRecord[]> {
  const keys = await store.list("product/");
  const rows = await Promise.all(keys.map(async (k) => ((await (store.getListed ?? store.get).call(store, k)) as { value: ProductRecord } | null)?.value));
  return rows.filter((r): r is ProductRecord => !!r && !r.deletedAt);
}

export async function listRecords(store: KvStore, now = new Date()): Promise<ProductRecord[]> {
  let rows = await readAll(store);
  const stuck = rows.filter((r) => isStale(r.pending, now));
  if (stuck.length) {
    for (const r of stuck) await reconcileRecord(store, r.id, now);
    rows = await readAll(store);
  }
  return rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
}

export async function getRecord(store: KvStore, id: string, now = new Date()): Promise<ProductRecord | null> {
  let rec = (await store.get<ProductRecord>(recordKey(id)))?.value ?? null;
  if (rec && isStale(rec.pending, now)) {
    await reconcileRecord(store, id, now);
    rec = (await store.get<ProductRecord>(recordKey(id)))?.value ?? null;
  }
  return rec && !rec.deletedAt ? rec : null;
}

/**
 * Resolve an interrupted publish/unpublish from what the live catalog shows.
 * Only touches intents older than PENDING_STALE_MS, so it never races a
 * publish that is still running. Safe to call any number of times.
 */
export async function reconcileRecord(store: KvStore, id: string, now = new Date()): Promise<"none" | "finished" | "undone"> {
  const cur = (await store.get<ProductRecord>(recordKey(id)))?.value;
  const p = cur?.pending;
  if (!cur || !p || !isStale(p, now)) return "none";
  const live = await currentRelease(store);
  const onSite = live?.products.find((x) => x.id === id);
  const done = p.op === "publish" ? !!onSite && publicHash(onSite) === p.hash : !onSite;
  let result: "none" | "finished" | "undone" = "none";
  await updateWithRetry<ProductRecord>(store, recordKey(id), (r) => {
    if (!r || r.pending?.token !== p.token) return undefined;
    result = done ? "finished" : "undone";
    if (!done) return { ...r, pending: null };
    const at = now.toISOString();
    const patch: Partial<ProductRecord> =
      p.op === "publish"
        ? { status: "published", publishedRev: r.rev + 1, publishedAt: r.publishedAt ?? p.at }
        : { status: p.to ?? "draft", publishedRev: null };
    const summary = p.op === "publish" ? "Published (finished after an interrupted publish)" : "Taken off the website (finished after an interrupted change)";
    return { ...r, ...patch, pending: null, rev: r.rev + 1, updatedAt: at, history: [{ at, summary }, ...r.history].slice(0, HISTORY) };
  });
  return result;
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
  await reconcileRecord(store, id, now);
  await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => {
    if (!cur || cur.deletedAt) return ((out = { ok: false, error: "That product no longer exists." }), undefined);
    if (cur.pending) return ((out = { ok: false, conflict: true, error: "This product is being published or taken off the website right now. Reload in a moment, then make your change." }), undefined);
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

/**
 * Only never-published drafts can be deleted (anything that was live is archived instead, so its history stays).
 * Step 1 replaces the record with a tombstone by compare-and-set — a publish or save that got in first makes
 * this fail and re-check; one that comes later sees the tombstone. Step 2 removes the tombstone (if that
 * fails, the tombstone simply stays: it's never shown and can't be written to).
 */
export async function deleteDraft(store: KvStore, id: string, expectedRev: number, now = new Date()): Promise<SaveResult> {
  await reconcileRecord(store, id, now);
  if ((await currentRelease(store))?.products.some((p) => p.id === id)) return { ok: false, error: "This product is on the website. Take it off (archive) instead." };
  let out: SaveResult = { ok: false, error: "That product no longer exists." };
  await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => {
    if (!cur || cur.deletedAt) return ((out = { ok: false, error: "That product no longer exists." }), undefined);
    if (cur.pending) return ((out = { ok: false, conflict: true, error: "This product is being published right now, so it can't be deleted. Reload in a moment." }), undefined);
    if (cur.rev !== expectedRev) return ((out = { ok: false, conflict: true, error: "This product changed since you opened it. Reload first." }), undefined);
    if (cur.publishedAt || cur.status === "published") return ((out = { ok: false, error: "This product has been published before, so it can only be archived (its record stays for your history)." }), undefined);
    const tomb: ProductRecord = { ...cur, deletedAt: now.toISOString(), rev: cur.rev + 1 };
    out = { ok: true, record: cur };
    return tomb;
  });
  if (out.ok) {
    try {
      await store.delete(recordKey(id));
    } catch {
      /* the tombstone stays; it's invisible and blocks any later write */
    }
  }
  return out;
}

/* ------------------------- publish intent (claim / finish / undo) ------------------------- */

type Claim = { ok: true; rec: ProductRecord; token: string } | { ok: false; error: string };

async function claimChange(store: KvStore, id: string, expectedRev: number, change: Omit<PendingChange, "token" | "at">, now: Date): Promise<Claim> {
  const token = randomUUID();
  let out: Claim = { ok: false, error: "That product no longer exists." };
  await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => {
    if (!cur || cur.deletedAt) return ((out = { ok: false, error: "That product no longer exists." }), undefined);
    if (cur.pending) return ((out = { ok: false, error: "Another publish or unpublish of this product is still running. Reload in a moment." }), undefined);
    if (cur.rev !== expectedRev) return ((out = { ok: false, error: "This product changed since you opened it. Reload, check it, then try again." }), undefined);
    const next = { ...cur, pending: { ...change, token, at: now.toISOString() } };
    out = { ok: true, rec: next, token };
    return next;
  });
  return out;
}

/** Drop our own intent (the public catalog wasn't changed). */
async function undoClaim(store: KvStore, id: string, token: string) {
  try {
    await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => (cur && cur.pending?.token === token ? { ...cur, pending: null } : undefined));
  } catch {
    /* left for reconcileRecord: the catalog doesn't show the change, so it will be undone */
  }
}

/** Finish our own intent. Returns null if the record couldn't be written (then reconcileRecord finishes it later). */
async function finishClaim(store: KvStore, id: string, token: string, summary: string, patch: (r: ProductRecord) => Partial<ProductRecord>, now: Date): Promise<ProductRecord | null> {
  try {
    const { value, changed } = await updateWithRetry<ProductRecord>(store, recordKey(id), (cur) => {
      if (!cur || cur.pending?.token !== token) return undefined;
      const at = now.toISOString();
      return { ...cur, ...patch(cur), pending: null, rev: cur.rev + 1, updatedAt: at, history: [{ at, summary }, ...cur.history].slice(0, HISTORY) };
    });
    return changed ? value : null;
  } catch {
    return null;
  }
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
  const rec = await getRecord(store, id, now);
  if (!rec) return { ok: false, error: "That product no longer exists." };
  if (rec.rev !== expectedRev) return { ok: false, error: "This product changed since you opened it. Reload, check it, then publish." };
  if (rec.status === "archived") return { ok: false, error: "Restore this product from the archive first." };
  const readiness = productReadiness(rec, ctx);
  if (!readiness.ready) return { ok: false, error: "This product isn't ready to publish yet.", missing: readiness.items.filter((i) => !i.ok).flatMap((i) => i.missing.map((m) => `${i.label}: ${m}`)) };
  const pub = toPublicProduct({ ...rec, status: "published" });
  const claim = await claimChange(store, id, expectedRev, { op: "publish", hash: publicHash(pub) }, now);
  if (!claim.ok) return claim;
  let r: ReleaseResult;
  try {
    r = await makeRelease(store, `Published ${rec.product.name}`, (list) => [...list.filter((p) => p.id !== id), pub], now);
  } catch {
    r = { ok: false, error: "Couldn't reach storage to publish. Nothing changed on the website — try again." };
  }
  if (!r.ok) {
    await undoClaim(store, id, claim.token);
    return r;
  }
  const saved = await finishClaim(store, id, claim.token, `Published (catalog release ${r.release.seq})`, (x) => ({ status: "published", publishedRev: x.rev + 1, publishedAt: now.toISOString() }), now);
  if (!saved) return { ok: false, error: `The product went live (release ${r.release.seq}), but its record couldn't be updated just now. It will show as published automatically within a few minutes — don't publish it again.` };
  return { ok: true, release: r.release, record: saved };
}

/** Take a product off the website (to draft, or to the archive). */
export async function unpublishProduct(store: KvStore, id: string, expectedRev: number, to: "draft" | "archived", now = new Date()): Promise<PublishResult> {
  const rec = await getRecord(store, id, now);
  if (!rec) return { ok: false, error: "That product no longer exists." };
  if (rec.rev !== expectedRev) return { ok: false, error: "This product changed since you opened it. Reload first." };
  const claim = await claimChange(store, id, expectedRev, { op: "unpublish", to }, now);
  if (!claim.ok) return claim;
  let release: Release | null;
  try {
    release = await currentRelease(store);
    if (release?.products.some((p) => p.id === id)) {
      const r = await makeRelease(store, `${to === "archived" ? "Archived" : "Unpublished"} ${rec.product.name}`, (list) => list.filter((p) => p.id !== id), now);
      if (!r.ok) {
        await undoClaim(store, id, claim.token);
        return r;
      }
      release = r.release;
    }
  } catch {
    await undoClaim(store, id, claim.token);
    return { ok: false, error: "Couldn't reach storage. Nothing changed on the website — try again." };
  }
  const saved = await finishClaim(store, id, claim.token, to === "archived" ? "Archived" : "Moved back to draft", () => ({ status: to, publishedRev: null }), now);
  if (!saved) return { ok: false, error: "The product was taken off the website, but its record couldn't be updated just now. It will catch up automatically within a few minutes." };
  return { ok: true, release: release ?? (await currentRelease(store))!, record: saved };
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
