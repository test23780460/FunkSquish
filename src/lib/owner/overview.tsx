import "server-only";
import type { ReactNode } from "react";
import type { KvStore } from "@/lib/storage/kv";
import type { PartnerConfig } from "@/lib/partners/config";
import type { Order } from "@/commerce/orders/types";
import { currentRelease, listRecords, liveDiffers } from "@/commerce/catalog-admin/store";
import { productReadiness } from "@/commerce/catalog-admin/readiness";
import { lastBackup } from "./backup";
import { readinessContextFor } from "./products";

/**
 * Extra Overview content from the dashboard's own records (products,
 * suppliers…). Each section adds its tiles and warnings here, so the
 * Overview page doesn't need to know every module. Counts only — never estimates.
 */
export interface OverviewExtras {
  tiles: { label: string; value: ReactNode; note?: string; href?: string; tone?: "plain" | "warn" | "alert" }[];
  sections: ReactNode;
  warnings: { text: string; href?: string }[];
}

export async function overviewExtras({ data, now }: { cfg: Pick<PartnerConfig, "storage" | "storeSuffix">; data: KvStore; orders: Order[]; now: Date }): Promise<OverviewExtras> {
  const warnings: OverviewExtras["warnings"] = [];
  const tiles: OverviewExtras["tiles"] = [];
  const [records, live, backup] = await Promise.all([listRecords(data), currentRelease(data), lastBackup(data)]);
  const suppliers = (await data.list("supplier/")).length;

  const drafts = records.filter((r) => r.status === "draft");
  const ready = [];
  for (const r of drafts) if (productReadiness(r, await readinessContextFor(data, r.id, records)).ready) ready.push(r);
  const changed = records.filter((r) => liveDiffers(r, live));
  tiles.push(
    { label: "Products on the website", value: records.filter((r) => r.status === "published").length, note: live ? `Catalog release ${live.seq}` : "Nothing published yet", href: "/partners/review/products?f=published" },
    { label: "Drafts", value: drafts.length, note: "Private, not on the website", href: "/partners/review/products?f=draft" },
    { label: "Ready to publish", value: ready.length, note: "Every checklist item passes", href: "/partners/review/products?f=ready", tone: ready.length ? "warn" : "plain" },
    { label: "Unpublished edits", value: changed.length, note: "Published products with newer edits", href: "/partners/review/products?f=changed", tone: changed.length ? "warn" : "plain" },
  );

  if ((records.length || suppliers) && (!backup || now.getTime() - Date.parse(backup) > 30 * 86_400_000))
    warnings.push({ text: backup ? `Last dashboard backup was ${backup.slice(0, 10)}. Download a fresh one.` : "You haven't downloaded a dashboard backup yet.", href: "/partners/review/settings#backup" });
  return { tiles, sections: null, warnings };
}
