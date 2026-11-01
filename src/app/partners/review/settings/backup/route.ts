import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { environmentName, exportOwnerData, recordBackup } from "@/lib/owner/backup";

/**
 * PRIVATE download: the dashboard backup (JSON). Signed-in owner only,
 * built per request, never cached. Holds private costs and supplier terms.
 */
export async function GET() {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const store = await ownerDataStore(ctx.cfg);
  const now = new Date();
  const env = environmentName(ctx.cfg);
  const backup = await exportOwnerData(store, env, now);
  await recordBackup(store, now);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="funksquish-dashboard-${env}-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
