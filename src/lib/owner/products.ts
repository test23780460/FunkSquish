import "server-only";
import type { KvStore } from "@/lib/storage/kv";
import { localProducts } from "@/commerce/providers/local";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { listRecords } from "@/commerce/catalog-admin/store";
import type { ReadinessContext } from "@/commerce/catalog-admin/readiness";
import type { ProductRecord } from "@/commerce/catalog-admin/record";

/** Shared lookups for the Products pages and actions (server only). */

export const buildTimeProducts = () => localProducts;

/** Supplier ids known to the dashboard (the Suppliers section stores them under supplier/<id>). */
export async function supplierIds(data: KvStore): Promise<Set<string>> {
  return new Set((await data.list("supplier/")).map((k) => k.slice("supplier/".length)).filter((k) => !k.includes("/")));
}

export async function readinessContextFor(data: KvStore, selfId: string, records?: ProductRecord[]): Promise<ReadinessContext> {
  const all = records ?? (await listRecords(data));
  const otherSkus = new Map<string, string>();
  for (const r of all) if (r.id !== selfId) for (const v of r.product.variants) otherSkus.set(v.sku, r.product.name);
  for (const p of localProducts) if (p.id !== selfId && !all.some((r) => r.id === p.id)) for (const v of p.variants) otherSkus.set(v.sku, p.name);
  return { origins: SHIPPING_ORIGINS, otherSkus, supplierIds: await supplierIds(data) };
}

/** Form values as plain text fields (files are handled separately). */
export function fieldsFrom(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && k.length < 60) out[k] = v.slice(0, 10_000);
  return out;
}

/** Supplier names for pickers (records live under supplier/<id>; see the Suppliers section). */
export async function supplierOptions(data: KvStore): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for (const k of await data.list("supplier/")) {
    if (k.slice("supplier/".length).includes("/")) continue;
    const s = await data.get<{ id: string; name: string; archived?: boolean }>(k);
    if (s && !s.value.archived) out.push({ id: s.value.id, name: s.value.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
