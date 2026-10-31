import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { salesCsvRows } from "@/commerce/analytics/report";
import { toCsv } from "@/commerce/catalog-admin/csv";

/** PRIVATE download: order lines for a period, for your bookkeeping. No customer names, emails or addresses. */
export async function GET(req: Request) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const days = Math.min(366, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const since = Date.now() - days * 86_400_000;
  const inv = await inventoryContext();
  const orders = (await listOrders(inv.store)).filter((o) => Date.parse(o.createdAt) >= since);
  const rows = salesCsvRows(orders);
  const csv = toCsv(rows, rows.length ? Object.keys(rows[0]) : ["order"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${inv.mode === "test" ? "TEST-" : ""}funksquish-sales-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
