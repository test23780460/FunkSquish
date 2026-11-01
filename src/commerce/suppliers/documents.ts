import { contentHash, sniff } from "../catalog-admin/media";

/**
 * Private supplier documents: agreements, price lists, catalogs, compliance
 * certificates, invoices. Stored in the private file store and only ever
 * downloaded by the signed-in owner (as an attachment — never shown on the
 * website). Accepted: PDF, JPEG/PNG/WebP photos or scans, and CSV price lists.
 * Office files and archives are refused (they can carry macros); export them
 * to PDF or CSV first.
 */
export const DOC_KINDS = { agreement: "Agreement", "price-list": "Price list / quote", catalog: "Product catalog", compliance: "Compliance (CPC, test report)", invoice: "Invoice", other: "Other" } as const;
export type DocKind = keyof typeof DOC_KINDS;
export const MAX_DOC_BYTES = 4 * 1024 * 1024;

export interface SupplierDoc {
  id: string;
  supplierId: string;
  kind: DocKind;
  /** Display name (from your upload, cleaned); the stored file is named by its content hash. */
  name: string;
  file: string;
  contentType: string;
  bytes: number;
  uploadedAt: string;
  note: string | null;
}

export const docKey = (supplierId: string, docId: string) => `supplier-doc/${supplierId}/${docId}`;
export const docFileKey = (supplierId: string, file: string) => `s/${supplierId}/${file}`;
export const DOC_FILE = /^[a-f0-9]{32}\.(pdf|jpg|png|webp|csv)$/;

export type CheckedDoc = { ok: true; file: string; contentType: string; bytes: Uint8Array } | { ok: false; error: string };

export function checkDocument(b: Uint8Array): CheckedDoc {
  if (!b.length) return { ok: false, error: "That file is empty." };
  if (b.length > MAX_DOC_BYTES) return { ok: false, error: "Documents can be up to 4 MB." };
  const hash = contentHash(b);
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { ok: true, file: `${hash}.pdf`, contentType: "application/pdf", bytes: b };
  const img = sniff(b);
  if (img?.kind === "image") return { ok: true, file: `${hash}.${img.ext}`, contentType: img.contentType, bytes: b };
  // CSV: valid UTF-8 text with no control characters other than tab/newlines, and at least one comma.
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(b);
    if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) && text.includes(",") && !/^\s*</.test(text)) return { ok: true, file: `${hash}.csv`, contentType: "text/csv; charset=utf-8", bytes: b };
  } catch {
    /* not text */
  }
  return { ok: false, error: "Upload a PDF, a photo/scan (JPEG, PNG, WebP) or a CSV. Save Word/Excel files as PDF or CSV first." };
}

/** Safe display name: letters, numbers, spaces and . _ - only. */
export const cleanName = (n: string) => n.replace(/[^\w .-]+/g, "_").replace(/^[.\s]+/, "").slice(0, 80) || "document";

/**
 * Content-Disposition for a document download. The owner-typed name can hold
 * anything (quotes, line breaks, emoji), so the plain filename is reduced to
 * safe ASCII and the full name goes in RFC 5987 `filename*`. A bad character
 * can never break the header or make the download fail.
 */
export function downloadDisposition(name: string, file: string): string {
  const ext = file.split(".").pop() ?? "";
  const base = name.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "document";
  const full = /\.[A-Za-z0-9]{1,5}$/.test(base) ? base : `${base}.${ext}`;
  const ascii = full.normalize("NFKD").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/_+/g, "_").slice(0, 100) || `document.${ext}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(full.slice(0, 150))}`;
}
