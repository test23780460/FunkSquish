import { connection } from "next/server";
import { deployStorage } from "@/lib/partners/config";
import { ownerMediaStore } from "@/lib/owner/data";
import { fileResponse } from "@/lib/owner/serve-file";
import { cachedReleaseProducts } from "@/commerce/catalog-release";
import { MEDIA_FILE, mediaKey, mediaPath } from "@/commerce/catalog-admin/media";

/**
 * PUBLIC product photos and videos uploaded in the owner dashboard.
 * A file is served only while a product in the PUBLISHED catalog uses it:
 * drafts' photos, removed photos and anything else in the private store
 * answer 404. File names are content hashes, so a URL can't be guessed.
 */
const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });

export async function GET(req: Request, { params }: RouteContext<"/media/[file]">) {
  await connection();
  const { file } = await params;
  if (!MEDIA_FILE.test(file)) return notFound();
  const storage = deployStorage();
  if (!storage) return notFound();
  const src = mediaPath(file);
  const products = (await cachedReleaseProducts()) ?? [];
  if (!products.some((p) => p.media.some((m) => m.src === src || m.poster === src))) return notFound();
  const stored = await (await ownerMediaStore(storage)).get(mediaKey(file));
  if (!stored) return notFound();
  // Content-addressed and public: cache for a day (a removed photo can linger in caches up to that long).
  return fileResponse(stored, req, { "Cache-Control": "public, max-age=86400, s-maxage=86400", "Content-Disposition": "inline" });
}
