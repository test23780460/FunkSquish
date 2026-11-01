"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerMediaStore, ownerTools } from "@/lib/owner/data";
import { fieldsFrom } from "@/lib/owner/products";
import { applySupplierForm, createSupplier, getSupplier, parseLogEntry, parseQuote, saveSupplier, SUPPLIER_ID } from "@/commerce/suppliers/supplier";
import { checkDocument, cleanName, docFileKey, docKey, DOC_KINDS, type DocKind, type SupplierDoc } from "@/commerce/suppliers/documents";

/*
 * Owner-only supplier actions. Server actions are public endpoints, so each
 * one re-checks the fully signed-in owner first, validates on the server,
 * is rate limited and audited. Supplier data never leaves the private store.
 */

const BASE = "/partners/review/suppliers";
const page = (id: string, q: Record<string, string>, hash = "") => `${BASE}/${id}?${new URLSearchParams(q).toString()}${hash ? `#${hash}` : ""}`;

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  const tools = await ownerTools(ctx);
  return { ctx, tools, data: tools.data };
}

function target(fd: FormData): { id: string; rev: number } {
  const id = String(fd.get("id") ?? "");
  const rev = Number(fd.get("rev"));
  if (!SUPPLIER_ID.test(id) || !Number.isSafeInteger(rev)) redirect(BASE);
  return { id, rev };
}

export async function createSupplierAction(fd: FormData) {
  const { tools, data } = await context();
  if (!(await tools.allow("supplier-write", 200, 60 * 60))) redirect(`${BASE}?error=${encodeURIComponent("Too many changes in an hour.")}`);
  const r = await createSupplier(data, String(fd.get("name") ?? ""));
  if (!r.ok) redirect(`${BASE}?error=${encodeURIComponent(r.error)}`);
  await tools.audit("suppliers", "create", r.supplier.id, `Added supplier "${r.supplier.name}"`);
  redirect(page(r.supplier.id, { ok: "Supplier added. Fill in what you know; leave the rest empty (it shows as missing)." }));
}

async function edit(fd: FormData, summary: string, hash: string, fn: Parameters<typeof saveSupplier>[3]) {
  const { tools, data } = await context();
  const { id, rev } = target(fd);
  if (!(await tools.allow("supplier-write", 200, 60 * 60))) redirect(page(id, { error: "Too many changes in an hour." }, hash));
  const r = await saveSupplier(data, id, rev, fn);
  if (!r.ok) redirect(page(id, { error: r.error.slice(0, 300) }, hash));
  await tools.audit("suppliers", "edit", id, `${r.supplier.name}: ${summary}`);
  redirect(page(id, { ok: `Saved: ${summary.toLowerCase()}.` }, hash));
}

export async function saveSupplierAction(fd: FormData) {
  await context();
  const f = fieldsFrom(fd);
  await edit(fd, "Details and terms", "details", (s) => applySupplierForm(s, f));
}

export async function addQuoteAction(fd: FormData) {
  await context();
  const q = parseQuote(fieldsFrom(fd));
  await edit(fd, typeof q === "string" ? "Quote" : `Quote for ${q.product}`, "quotes", (s) => (typeof q === "string" ? q : s.quotes.length >= 100 ? "Up to 100 quotes per supplier." : { ...s, quotes: [q, ...s.quotes] }));
}

export async function removeQuoteAction(fd: FormData) {
  await context();
  const qid = String(fd.get("quote") ?? "");
  await edit(fd, "Removed a quote", "quotes", (s) => (s.quotes.some((q) => q.id === qid) ? { ...s, quotes: s.quotes.filter((q) => q.id !== qid) } : "That quote was already removed."));
}

export async function addLogAction(fd: FormData) {
  await context();
  const e = parseLogEntry(fieldsFrom(fd));
  await edit(fd, "Contact note", "log", (s) => (typeof e === "string" ? e : { ...s, log: [e, ...s.log].slice(0, 300) }));
}

export async function logDoneAction(fd: FormData) {
  await context();
  const lid = String(fd.get("entry") ?? "");
  await edit(fd, "Follow-up done", "log", (s) => (s.log.some((l) => l.id === lid) ? { ...s, log: s.log.map((l) => (l.id === lid ? { ...l, done: true } : l)) } : "That note no longer exists."));
}

export async function archiveSupplierAction(fd: FormData) {
  await context();
  const archive = fd.get("archive") === "yes";
  await edit(fd, archive ? "Archived" : "Restored", "details", (s) => ({ ...s, archived: archive }));
}

/* ------------------------------ private documents ------------------------------ */

export async function uploadDocAction(fd: FormData) {
  const { ctx, tools, data } = await context();
  const { id } = target(fd);
  if (!(await tools.allow("supplier-docs", 60, 60 * 60))) redirect(page(id, { error: "Too many uploads in an hour." }, "docs"));
  const supplier = await getSupplier(data, id);
  if (!supplier) redirect(BASE);
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(page(id, { error: "Choose a file." }, "docs"));
  const kind = String(fd.get("kind") ?? "other") as DocKind;
  const checked = checkDocument(new Uint8Array(await file.arrayBuffer()));
  if (!checked.ok) redirect(page(id, { error: checked.error }, "docs"));
  const media = await ownerMediaStore(ctx.cfg);
  await media.put(docFileKey(id, checked.file), { bytes: checked.bytes, contentType: checked.contentType, meta: { bytes: String(checked.bytes.length), uploadedAt: new Date().toISOString() } });
  const doc: SupplierDoc = {
    id: randomBytes(6).toString("hex"),
    supplierId: id,
    kind: kind in DOC_KINDS ? kind : "other",
    name: cleanName(file.name),
    file: checked.file,
    contentType: checked.contentType,
    bytes: checked.bytes.length,
    uploadedAt: new Date().toISOString(),
    note: String(fd.get("note") ?? "").trim().slice(0, 200) || null,
  };
  await data.create(docKey(id, doc.id), doc);
  await tools.audit("suppliers", "document", id, `${supplier.name}: added ${DOC_KINDS[doc.kind].toLowerCase()} document`);
  redirect(page(id, { ok: "Document saved privately." }, "docs"));
}

export async function deleteDocAction(fd: FormData) {
  const { ctx, tools, data } = await context();
  const { id } = target(fd);
  const docId = String(fd.get("doc") ?? "");
  if (!/^[a-f0-9]{12}$/.test(docId)) redirect(page(id, {}, "docs"));
  if (fd.get("confirm") !== "on") redirect(page(id, { error: "Tick the box to confirm deleting the document." }, "docs"));
  const doc = (await data.get<SupplierDoc>(docKey(id, docId)))?.value;
  if (!doc) redirect(page(id, { error: "That document was already deleted." }, "docs"));
  await data.delete(docKey(id, docId));
  // The file itself goes only if no other document record points at the same content.
  const others = await data.list(`supplier-doc/${id}/`);
  let shared = false;
  for (const k of others) if ((await data.get<SupplierDoc>(k))?.value.file === doc.file) shared = true;
  if (!shared) await (await ownerMediaStore(ctx.cfg)).delete(docFileKey(id, doc.file));
  await tools.audit("suppliers", "document-deleted", id, `Deleted a ${DOC_KINDS[doc.kind].toLowerCase()} document`);
  redirect(page(id, { ok: "Document deleted." }, "docs"));
}
