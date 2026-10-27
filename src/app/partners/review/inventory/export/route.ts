import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { loadHistory, parseExportRange, toCsv } from "@/commerce/orders/stock-export";

/**
 * GET /partners/review/inventory/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Inventory history as CSV — signed-in owner only (the same check as every
 * owner page, so it needs two-step sign-in wherever that's required).
 * Anyone else gets a plain 404. Never cached; logs counts only.
 */
const PRIVATE = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const text = (status: number, body: string) => new Response(body, { status, headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request): Promise<Response> {
  // Always per request: without this, the build would prerender the signed-out 404 as a static file.
  await connection();
  if (!reviewConfig()) return text(404, "Not found");
  if (!(await requireReviewer())) return text(404, "Not found");

  const url = new URL(request.url);
  const range = parseExportRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range.ok) return text(400, range.error);

  const ctx = await inventoryContext();
  const history = await loadHistory(ctx.store, range.from, range.to);
  if (!history.ok) return text(400, history.error);

  const names = new Map(ctx.items.map((i) => [i.variantId, { product: i.productName, variant: i.variantName }]));
  const csv = toCsv(history.rows, names);
  const label = ctx.mode === "test" ? "TEST-" : "";
  console.info(`[inventory] history export mode=${ctx.mode} days=${range.from}..${range.to} rows=${history.rows.length}`);
  return new Response(csv, {
    status: 200,
    headers: {
      ...PRIVATE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${label}funksquish-inventory-history-${range.from}-to-${range.to}.csv"`,
    },
  });
}
