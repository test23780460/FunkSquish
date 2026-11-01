import "server-only";
import type { ReactNode } from "react";
import type { KvStore } from "@/lib/storage/kv";
import type { PartnerConfig } from "@/lib/partners/config";
import type { Order } from "@/commerce/orders/types";
import { lastBackup } from "./backup";

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
  const [records, backup] = await Promise.all([data.list("product/").then((k) => k.length + 0), lastBackup(data)]);
  const suppliers = (await data.list("supplier/")).length;
  if ((records || suppliers) && (!backup || now.getTime() - Date.parse(backup) > 30 * 86_400_000))
    warnings.push({ text: backup ? `Last dashboard backup was ${backup.slice(0, 10)}. Download a fresh one.` : "You haven't downloaded a dashboard backup yet.", href: "/partners/review/settings#backup" });
  return { tiles: [], sections: null, warnings };
}
