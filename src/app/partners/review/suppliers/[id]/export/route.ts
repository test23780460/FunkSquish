import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { appendAudit, ownerDataStore } from "@/lib/owner/data";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { listRecords } from "@/commerce/catalog-admin/store";
import { getSupplier, listSuppliers, mayShareCustomerData } from "@/commerce/suppliers/supplier";
import { packagesFor, supplierCsv } from "@/commerce/suppliers/export";

/**
 * PRIVATE download: this supplier's packages still to be placed, as a CSV for
 * their order portal. Holds customer names and addresses, so it's refused
 * unless the supplier's signed agreement limits how they use them. Every
 * download is recorded in the activity log (without the details).
 */
const nope = (msg = "Not found", status = 404) => new Response(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: RouteContext<"/partners/review/suppliers/[id]/export">) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return nope();
  const { id } = await params;
  const data = await ownerDataStore(ctx.cfg);
  const supplier = await getSupplier(data, id);
  if (!supplier) return nope();
  const share = mayShareCustomerData(supplier);
  if (!share.ok) return nope(`Not exported: ${share.reason} Customer names and addresses only go to a supplier under a signed agreement that limits their use.`, 403);
  const includePhone = new URL(req.url).searchParams.get("phone") === "1";
  const inv = await inventoryContext();
  const [orders, records, suppliers] = await Promise.all([listOrders(inv.store), listRecords(data), listSuppliers(data)]);
  const pkgs = packagesFor(supplier, orders, records, suppliers, "to-place");
  await appendAudit(data, { area: "fulfillment", action: "supplier-export", target: supplier.id, summary: `Downloaded ${pkgs.length} package(s) to place with ${supplier.name} (${includePhone ? "with" : "without"} phone numbers)` });
  return new Response(supplierCsv(pkgs, { includePhone }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${inv.mode === "test" ? "TEST-" : ""}packages-for-${supplier.name.replace(/[^\w-]+/g, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
