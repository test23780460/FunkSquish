import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { listRecords } from "@/commerce/catalog-admin/store";
import { recordsToCsv } from "@/commerce/catalog-admin/csv";

/**
 * PRIVATE download: the dashboard's products as the catalog spreadsheet.
 * `?private=1` adds costs, supplier links and compliance references — keep
 * that file in your private folder, never in GitHub or email.
 */
export async function GET(req: Request) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const includePrivate = new URL(req.url).searchParams.get("private") === "1";
  const data = await ownerDataStore(ctx.cfg);
  const records = await listRecords(data);
  const names = new Map<string, string>();
  if (includePrivate)
    for (const k of await data.list("supplier/")) {
      const s = await data.get<{ id: string; name: string }>(k);
      if (s && !k.slice(9).includes("/")) names.set(s.value.id, s.value.name);
    }
  const csv = recordsToCsv(records, { includePrivate, supplierName: (id) => names.get(id) ?? null });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="funksquish-catalog-${includePrivate ? "PRIVATE-" : ""}${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
