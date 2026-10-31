import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore, ownerMediaStore } from "@/lib/owner/data";
import { docFileKey, docKey, type SupplierDoc } from "@/commerce/suppliers/documents";
import { SUPPLIER_ID } from "@/commerce/suppliers/supplier";

/** PRIVATE download of one supplier document. Signed-in owner only, always as a download, never cached. */
const nope = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_req: Request, { params }: RouteContext<"/partners/review/suppliers/[id]/docs/[doc]">) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return nope();
  const { id, doc } = await params;
  if (!SUPPLIER_ID.test(id) || !/^[a-f0-9]{12}$/.test(doc)) return nope();
  const meta = (await (await ownerDataStore(ctx.cfg)).get<SupplierDoc>(docKey(id, doc)))?.value;
  if (!meta) return nope();
  const file = await (await ownerMediaStore(ctx.cfg)).get(docFileKey(id, meta.file));
  if (!file) return nope();
  const body = file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": meta.contentType,
      "Content-Disposition": `attachment; filename="${meta.name.replace(/"/g, "")}${meta.name.includes(".") ? "" : `.${meta.file.split(".").pop()}`}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
