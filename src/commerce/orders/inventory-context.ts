import "server-only";
import { activeMode } from "../checkout/service";
import { testCheckoutEnabled } from "../checkout/environment";
import { TEST_FIXTURE_PRODUCTS, TEST_SHIPPING_ORIGINS, isTestFixtureVariant } from "../checkout/test-fixtures";
import { localProducts } from "../providers/local";
import { deployStorage } from "@/lib/partners/config";
import { ownerDataStore } from "@/lib/owner/data";
import { listRecords } from "../catalog-admin/store";
import { toPublicProduct } from "../catalog-admin/record";
import { canPurchase } from "../availability";
import { staticOriginProblem, findOrigin, originIdFor } from "../origins";
import { getLiveOrderStore, getTestOrderStore, type KvStore } from "./store";
import type { Product, ProductVariant } from "../types";
import type { StockItem } from "./stock-admin";

/**
 * Which stock the private inventory page manages here.
 *  - Production: the REAL stock (live order store), for every real product —
 *    published or still a draft, from the dashboard (Products) and the
 *    build-time catalog. Works before website checkout opens, so
 *    TikTok sales can be tracked from day one. Never anything else.
 *  - Previews and local dev: the TEST fixtures in the test store only.
 * Test and real stock never share a store (store.ts).
 */
export interface InventoryContext {
  mode: "test" | "live";
  label: string;
  store: KvStore;
  checkoutOpen: boolean;
  items: (StockItem & { catalogOnHand: number | null; tiktokFromCatalog: boolean })[];
  catalogOnHand(variantId: string): number | null;
}

const tiktokUrl = (url: string | null) => {
  try {
    return !!url && /(^|\.)tiktok\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

function itemsFrom(products: Product[], sellable: (p: Product, v: ProductVariant) => boolean): InventoryContext["items"] {
  return products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      sku: v.sku,
      productName: p.name,
      variantName: v.name,
      published: p.publication === "published",
      websiteSellable: sellable(p, v),
      supplier: (v.fulfillmentSource ?? "in_house") === "supplier",
      catalogOnHand: v.inventory.tracked ? v.inventory.available : null,
      tiktokFromCatalog: tiktokUrl(v.externalPurchaseUrl),
    })),
  );
}

export async function inventoryContext(): Promise<InventoryContext> {
  const mode = activeMode();
  if (mode === "live" || (!mode && process.env.BUILD_CONTEXT === "production")) {
    const products = await realProducts();
    const items = itemsFrom(products, canPurchase);
    return {
      mode: "live",
      label: mode === "live" ? "Real stock — website checkout is open." : "Real stock — website checkout isn't open yet, so only you change these numbers.",
      store: await getLiveOrderStore(),
      checkoutOpen: mode === "live",
      items,
      catalogOnHand: (id) => items.find((i) => i.variantId === id)?.catalogOnHand ?? null,
    };
  }
  const open = testCheckoutEnabled();
  const items = itemsFrom(TEST_FIXTURE_PRODUCTS, (_p, v) => open && isTestFixtureVariant(v.id) && !staticOriginProblem(findOrigin(TEST_SHIPPING_ORIGINS, originIdFor(v)), v.fulfillmentSource ?? "in_house"));
  return {
    mode: "test",
    label: "TEST stock (made-up fixtures) — not your real inventory.",
    store: await getTestOrderStore(),
    checkoutOpen: open,
    items,
    catalogOnHand: (id) => items.find((i) => i.variantId === id)?.catalogOnHand ?? null,
  };
}

/** Every real product: dashboard records (not archived) first, then build-time catalog products not in the dashboard. */
export async function realProducts(): Promise<Product[]> {
  const storage = deployStorage();
  const records = storage ? await listRecords(await ownerDataStore(storage)) : [];
  const fromDashboard = records.filter((r) => r.status !== "archived").map(toPublicProduct);
  const ids = new Set(records.map((r) => r.id));
  return [...fromDashboard, ...localProducts.filter((p) => (p.publication === "published" || p.publication === "draft") && !ids.has(p.id))];
}
