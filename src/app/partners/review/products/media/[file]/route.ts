import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerMediaStore } from "@/lib/owner/data";
import { fileResponse } from "@/lib/owner/serve-file";
import { MEDIA_FILE, mediaKey } from "@/commerce/catalog-admin/media";

/** PRIVATE: any uploaded product file, for the signed-in owner's previews (drafts included). Never cached. */
export async function GET(req: Request, { params }: RouteContext<"/partners/review/products/media/[file]">) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { file } = await params;
  if (!MEDIA_FILE.test(file)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const stored = await (await ownerMediaStore(ctx.cfg)).get(mediaKey(file));
  if (!stored) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return fileResponse(stored, req, { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });
}
