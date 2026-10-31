"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerMediaStore, ownerTools } from "@/lib/owner/data";
import { buildTimeProducts, fieldsFrom, readinessContextFor } from "@/lib/owner/products";
import { CATALOG_TAG } from "@/commerce/catalog-release";
import {
  addMedia,
  applyBasics,
  applySafety,
  CATEGORY_SLUGS,
  emptyPrivate,
  moveMedia,
  parseBasics,
  parseSafety,
  parseVariant,
  PRODUCT_ID,
  removeMedia,
  removeVariant,
  setMediaText,
  SLUG,
  upsertVariant,
  type ProductRecord,
} from "@/commerce/catalog-admin/record";
import { clashes, createRecord, currentRelease, deleteDraft, getRecord, listRecords, listReleases, publishProduct, recordKey, rollbackTo, saveRecord, unpublishProduct } from "@/commerce/catalog-admin/store";
import { checkUpload, MEDIA_FILE, mediaKey, mediaPath, VIDEO_SHAPES, type VideoShape } from "@/commerce/catalog-admin/media";
import { parseCsv, rowsToProducts } from "@/commerce/catalog-admin/csv";
import type { CategorySlug } from "@/commerce/types";

/*
 * Owner-only product actions. Server actions are public endpoints, so each
 * one re-checks the fully signed-in owner first (context()), validates every
 * field on the server, is rate limited, and writes an audit entry. A save
 * made from a stale copy of the form is refused (revision check).
 */

const BASE = "/partners/review/products";
const go = (path: string, q: Record<string, string> = {}, hash = "") => {
  const s = new URLSearchParams(q).toString();
  return `${path}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
};
const short = (s: string) => s.slice(0, 300);

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  const tools = await ownerTools(ctx);
  return { ctx, tools, data: tools.data };
}

function target(fd: FormData): { id: string; rev: number } {
  const id = String(fd.get("id") ?? "");
  const rev = Number(fd.get("rev"));
  if (!PRODUCT_ID.test(id) || !Number.isSafeInteger(rev)) redirect(BASE);
  return { id, rev };
}
const editor = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** Live catalog changed: refresh the cached copy the website reads. */
function refreshSite() {
  updateTag(CATALOG_TAG);
}

export async function createProductAction(fd: FormData) {
  const { tools, data } = await context();
  if (!(await tools.allow("product-write", 120, 60 * 60))) redirect(go(BASE, { error: "Too many changes in an hour. Try again later." }));
  const f = fieldsFrom(fd);
  const name = (f.name ?? "").trim().slice(0, 80);
  const slug = (f.slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const category = f.category as CategorySlug;
  if (!name || !SLUG.test(slug) || !CATEGORY_SLUGS.includes(category)) redirect(go(BASE, { error: "Give the product a name and pick a category." }, "new"));
  const r = await createRecord(data, { name, slug, category }, buildTimeProducts());
  if (!r.ok) redirect(go(BASE, { error: short(r.error) }, "new"));
  await tools.audit("products", "create", r.record.id, `Created draft "${name}"`);
  redirect(go(editor(r.record.id), { ok: "Draft created. Fill in the sections below; it stays private until you publish it." }));
}

async function save(fd: FormData, summary: string, section: string, fn: (r: ProductRecord) => { ok: true; record: ProductRecord } | { ok: false; error: string }) {
  const { tools, data } = await context();
  const { id, rev } = target(fd);
  if (!(await tools.allow("product-write", 240, 60 * 60))) redirect(go(editor(id), { error: "Too many changes in an hour. Try again later." }, section));
  const records = await listRecords(data);
  const r = await saveRecord(data, id, rev, summary, fn, (next) => clashes(records, buildTimeProducts(), next));
  if (!r.ok) redirect(go(editor(id), { error: short(r.error) }, section));
  await tools.audit("products", "edit", id, `${r.record.product.name}: ${summary}`);
  redirect(go(editor(id), { ok: `Saved: ${summary.toLowerCase()}.` }, section));
}

export async function saveBasicsAction(fd: FormData) {
  await context();
  const parsed = parseBasics(fieldsFrom(fd));
  if (!parsed.ok) redirect(go(editor(String(fd.get("id") ?? "")), { error: short(parsed.errors.join(" ")) }, "basics"));
  await save(fd, "Basics", "basics", (r) => ({ ok: true, record: applyBasics(r, parsed.value) }));
}

export async function saveSafetyAction(fd: FormData) {
  await context();
  const parsed = parseSafety(fieldsFrom(fd));
  if (!parsed.ok) redirect(go(editor(String(fd.get("id") ?? "")), { error: short(parsed.errors.join(" ")) }, "safety"));
  await save(fd, "Safety & compliance", "safety", (r) => ({ ok: true, record: applySafety(r, parsed.value) }));
}

export async function saveVariantAction(fd: FormData) {
  await context();
  const parsed = parseVariant(fieldsFrom(fd));
  if (!parsed.ok) redirect(go(editor(String(fd.get("id") ?? "")), { error: short(parsed.errors.join(" ")) }, "variants"));
  await save(fd, parsed.value.id ? `Variant ${parsed.value.sku}` : `Added variant ${parsed.value.sku}`, "variants", (r) => upsertVariant(r, parsed.value));
}

export async function removeVariantAction(fd: FormData) {
  await context();
  const variantId = String(fd.get("variantId") ?? "");
  await save(fd, `Removed variant ${variantId}`, "variants", (r) =>
    r.product.variants.some((v) => v.id === variantId) ? { ok: true, record: removeVariant(r, variantId) } : { ok: false, error: "That variant was already removed." },
  );
}

/* ------------------------------ media ------------------------------ */

export async function uploadMediaAction(fd: FormData) {
  const { ctx, tools, data } = await context();
  const { id, rev } = target(fd);
  if (!(await tools.allow("media-upload", 60, 60 * 60))) redirect(go(editor(id), { error: "Too many uploads in an hour. Try again later." }, "media"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(go(editor(id), { error: "Choose a photo or video." }, "media"));
  const alt = String(fd.get("alt") ?? "").trim().slice(0, 200);
  if (alt.length < 5) redirect(go(editor(id), { error: "Describe what the photo shows (alt text, 5+ characters) — it's read aloud to blind shoppers." }, "media"));
  const shape = String(fd.get("videoShape") ?? "portrait") as VideoShape;
  const checked = checkUpload(new Uint8Array(await file.arrayBuffer()), { videoShape: shape in VIDEO_SHAPES ? shape : "portrait" });
  if (!checked.ok) redirect(go(editor(id), { error: checked.error }, "media"));
  const name = `${checked.hash}.${checked.ext}`;
  const media = await ownerMediaStore(ctx.cfg);
  // Content-addressed: the same file uploaded twice is stored once.
  if (!(await media.head(mediaKey(name))))
    await media.put(mediaKey(name), { bytes: checked.bytes, contentType: checked.contentType, meta: { width: String(checked.width), height: String(checked.height), bytes: String(checked.bytes.length), uploadedAt: new Date().toISOString() } });
  const r = await saveRecord(data, id, rev, `Added ${checked.kind}`, (rec) => addMedia(rec, { type: checked.kind, src: mediaPath(name), alt, width: checked.width, height: checked.height }));
  if (!r.ok) redirect(go(editor(id), { error: short(r.error) }, "media"));
  await tools.audit("media", "upload", id, `${r.record.product.name}: added ${checked.kind} ${name}${checked.strippedBytes ? ` (removed ${checked.strippedBytes} bytes of hidden photo data)` : ""}`);
  redirect(go(editor(id), { ok: checked.strippedBytes ? "Uploaded. Hidden photo data (like GPS location) was removed." : "Uploaded." }, "media"));
}

const srcFrom = (fd: FormData) => {
  const src = String(fd.get("src") ?? "");
  const file = src.replace(/^\/media\//, "");
  return MEDIA_FILE.test(file) || /^\/products\/[a-z0-9-]+\/[\w.-]+$/i.test(src) ? src : null;
};

export async function mediaAction(fd: FormData) {
  await context();
  const src = srcFrom(fd);
  const op = String(fd.get("op") ?? "");
  if (!src) redirect(go(editor(String(fd.get("id") ?? "")), { error: "That file isn't on this product." }, "media"));
  if (op === "alt") {
    const alt = String(fd.get("alt") ?? "").trim();
    if (alt.length < 5) redirect(go(editor(String(fd.get("id") ?? "")), { error: "Alt text needs at least 5 characters." }, "media"));
    await save(fd, "Photo description", "media", (r) => ({ ok: true, record: setMediaText(r, src, alt) }));
  }
  if (op === "up" || op === "down" || op === "first") await save(fd, op === "first" ? "Featured photo" : "Photo order", "media", (r) => ({ ok: true, record: moveMedia(r, src, op) }));
  if (op === "remove") await save(fd, "Removed a photo/video", "media", (r) => ({ ok: true, record: removeMedia(r, src) }));
  redirect(editor(String(fd.get("id") ?? "")));
}

/**
 * Delete stored files no product and no kept release uses any more. Files
 * the live site shows are never touched.
 */
export async function cleanupMediaAction() {
  const { ctx, tools, data } = await context();
  if (!(await tools.allow("media-cleanup", 6, 60 * 60))) redirect(go(BASE, { error: "Try again later." }));
  const media = await ownerMediaStore(ctx.cfg);
  const used = new Set<string>();
  const add = (...srcs: (string | undefined)[]) => {
    for (const src of srcs) if (src?.startsWith("/media/")) used.add(src.slice(7));
  };
  for (const r of await listRecords(data)) for (const m of r.product.media) add(m.src, m.poster);
  for (const rel of await listReleases(data)) {
    const full = await data.get<{ products: { media: { src: string; poster?: string }[] }[] }>(`release/${String(rel.seq).padStart(6, "0")}`);
    for (const p of full?.value.products ?? []) for (const m of p.media) add(m.src, m.poster);
  }
  let removed = 0;
  for (const key of await media.list("p/")) {
    if (!used.has(key.slice(2))) {
      await media.delete(key);
      removed++;
    }
  }
  await tools.audit("media", "cleanup", null, `Deleted ${removed} unused product file(s)`);
  redirect(go(BASE, { ok: `Deleted ${removed} unused file(s). Files on the website or in kept releases were left alone.` }));
}

/* ------------------------------ publishing ------------------------------ */

export async function publishAction(fd: FormData) {
  const { tools, data } = await context();
  const { id, rev } = target(fd);
  if (!(await tools.allow("publish", 60, 60 * 60))) redirect(go(editor(id), { error: "Too many publishes in an hour." }, "publish"));
  if (!["on", "yes"].includes(String(fd.get("confirm")))) redirect(go(editor(id), { error: "Tick the box to confirm you checked the preview." }, "publish"));
  const r = await publishProduct(data, id, rev, await readinessContextFor(data, id));
  if (!r.ok) redirect(go(editor(id), { error: short([r.error, ...(r.missing ?? []).slice(0, 4)].join(" ")) }, "publish"));
  refreshSite();
  await tools.audit("products", "publish", id, `Published "${r.record.product.name}" (catalog release ${r.release.seq})`);
  redirect(go(editor(id), { ok: `Published. It's on the website now (release ${r.release.seq}). Buying stays closed until purchasing is switched on.` }, "publish"));
}

export async function unpublishAction(fd: FormData) {
  const { tools, data } = await context();
  const { id, rev } = target(fd);
  if (!(await tools.allow("publish", 60, 60 * 60))) redirect(go(editor(id), { error: "Too many changes in an hour." }, "publish"));
  const to = fd.get("to") === "archived" ? "archived" : "draft";
  const r = await unpublishProduct(data, id, rev, to);
  if (!r.ok) redirect(go(editor(id), { error: short(r.error) }, "publish"));
  refreshSite();
  await tools.audit("products", to === "archived" ? "archive" : "unpublish", id, `${to === "archived" ? "Archived" : "Unpublished"} "${r.record.product.name}"`);
  redirect(go(editor(id), { ok: to === "archived" ? "Archived and taken off the website." : "Taken off the website; it's a draft again." }, "publish"));
}

export async function restoreAction(fd: FormData) {
  await context();
  await save(fd, "Restored from the archive", "publish", (r) => (r.status === "archived" ? { ok: true, record: { ...r, status: "draft" } } : { ok: false, error: "This product isn't archived." }));
}

export async function deleteDraftAction(fd: FormData) {
  const { tools, data } = await context();
  const { id, rev } = target(fd);
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") redirect(go(editor(id), { error: "Type DELETE to delete this draft." }, "publish"));
  const r = await deleteDraft(data, id, rev);
  if (!r.ok) redirect(go(editor(id), { error: short(r.error) }, "publish"));
  await tools.audit("products", "delete-draft", id, `Deleted never-published draft "${r.record.product.name}"`);
  redirect(go(BASE, { ok: `Deleted the draft "${r.record.product.name}".` }));
}

export async function rollbackAction(fd: FormData) {
  const { tools, data } = await context();
  const seq = Number(fd.get("seq"));
  if (!(await tools.allow("publish", 60, 60 * 60))) redirect(go(`${BASE}/releases`, { error: "Too many changes in an hour." }));
  if (!["on", "yes"].includes(String(fd.get("confirm")))) redirect(go(`${BASE}/releases`, { error: "Tick the box to confirm the rollback." }));
  const live = await currentRelease(data);
  if (live?.seq === seq) redirect(go(`${BASE}/releases`, { error: "That release is already live." }));
  const r = await rollbackTo(data, seq);
  if (!r.ok) redirect(go(`${BASE}/releases`, { error: short(r.error) }));
  refreshSite();
  await tools.audit("products", "rollback", null, `Rolled the website catalog back to release ${seq} (new release ${r.release.seq})`);
  redirect(go(`${BASE}/releases`, { ok: `The website now shows release ${seq}'s catalog again (saved as release ${r.release.seq}).` }));
}

/* ------------------------------ import ------------------------------ */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

/**
 * Import the catalog spreadsheet. New products become drafts; products that
 * already exist (same web address) get the sheet's values as a new revision,
 * keeping their photos when the sheet lists none. Nothing is published, and
 * the "verified" ticks for prices and costs start off — you confirm them here.
 */
export async function importCsvAction(fd: FormData) {
  const { tools, data } = await context();
  const back = `${BASE}/import`;
  if (!(await tools.allow("import", 20, 60 * 60))) redirect(go(back, { error: "Too many imports in an hour." }));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(go(back, { error: "Choose the catalog .csv file." }));
  if (file.size > MAX_CSV_BYTES) redirect(go(back, { error: "That file is over 2 MB." }));
  const { products, errors } = rowsToProducts(parseCsv(await file.text()));
  if (errors.length) redirect(go(back, { error: short(`Nothing imported. Fix these rows first: ${errors.slice(0, 5).map((e) => `row ${e.line}: ${e.error}`).join("; ")}`) }));
  const records = await listRecords(data);
  const fresh = products.filter((p) => !records.some((r) => r.product.slug === p.product.slug));
  const updates = products.length - fresh.length;
  if (fd.get("intent") !== "import") redirect(go(back, { ok: `Check only — nothing saved. ${fresh.length} new product(s), ${updates} update(s), ${products.reduce((n, p) => n + p.product.variants.length, 0)} variant(s).` }));
  let created = 0;
  let updated = 0;
  const failed: string[] = [];
  for (const imp of products) {
    const existing = records.find((r) => r.product.slug === imp.product.slug);
    if (!existing) {
      const now = new Date().toISOString();
      const rec: ProductRecord = { id: imp.product.id, rev: 1, createdAt: now, updatedAt: now, status: "draft", publishedRev: null, publishedAt: null, history: [{ at: now, summary: "Imported from the catalog spreadsheet" }], product: { ...imp.product, publication: "draft" }, private: imp.private };
      if (!PRODUCT_ID.test(rec.id)) {
        failed.push(`${imp.product.slug}: web address too long for an id`);
        continue;
      }
      if (await data.create(recordKey(rec.id), rec)) created++;
      else failed.push(`${imp.product.slug}: already exists`);
    } else {
      const r = await saveRecord(data, existing.id, existing.rev, "Updated from the catalog spreadsheet", (cur) => ({
        ok: true,
        record: { ...cur, product: { ...imp.product, id: cur.id, publication: cur.product.publication, media: imp.product.media.length ? imp.product.media : cur.product.media, createdAt: cur.product.createdAt }, private: { ...imp.private, photosAuthentic: cur.private.photosAuthentic && !imp.product.media.length } },
      }));
      if (r.ok) updated++;
      else failed.push(`${imp.product.slug}: ${r.error}`);
    }
  }
  await tools.audit("products", "import", null, `Imported the catalog spreadsheet: ${created} new, ${updated} updated${failed.length ? `, ${failed.length} skipped` : ""}`);
  redirect(go(back, failed.length ? { error: short(`Imported ${created} new and ${updated} updated. Skipped: ${failed.join("; ")}`) } : { ok: `Imported ${created} new and ${updated} updated product(s) as drafts. Nothing was published.` }));
}

/** Copy products from the build-time catalog (products.json) into the dashboard as drafts. */
export async function importBuildCatalogAction() {
  const { tools, data } = await context();
  const back = `${BASE}/import`;
  if (!(await tools.allow("import", 20, 60 * 60))) redirect(go(back, { error: "Too many imports in an hour." }));
  let created = 0;
  for (const p of buildTimeProducts().filter((x) => x.publication !== "preview")) {
    if (await getRecord(data, p.id)) continue;
    const now = new Date().toISOString();
    const rec: ProductRecord = { id: p.id, rev: 1, createdAt: now, updatedAt: now, status: "draft", publishedRev: null, publishedAt: null, history: [{ at: now, summary: "Copied from the build-time catalog" }], product: { ...p, publication: "draft" }, private: emptyPrivate() };
    if (PRODUCT_ID.test(rec.id) && (await data.create(recordKey(rec.id), rec))) created++;
  }
  await tools.audit("products", "import", null, `Copied ${created} product(s) from the build-time catalog`);
  redirect(go(back, { ok: created ? `Copied ${created} product(s) as drafts.` : "Nothing to copy: the build-time catalog has no real products that aren't here already." }));
}
