import { Suspense, type ReactNode } from "react";
import type { Product } from "@/commerce/types";
import { purchasingEnabled } from "@/lib/features";
import { pendingStock, withLiveStock } from "@/commerce/live-stock";

/**
 * Renders `children` with the stock shoppers may be told about
 * (src/commerce/live-stock.ts).
 *  - Selling off (today): the products as they are; the page stays static.
 *  - Selling on: the static page shows "Checking stock…" (no stock claimed,
 *    no buy buttons), then each request streams in the live shared stock.
 */
export function LiveStock({ products, children }: { products: Product[]; children: (products: Product[]) => ReactNode }) {
  if (!purchasingEnabled) return children(products);
  return (
    <Suspense fallback={children(pendingStock(products))}>
      <Live products={products}>{children}</Live>
    </Suspense>
  );
}

async function Live({ products, children }: { products: Product[]; children: (products: Product[]) => ReactNode }) {
  return children(await withLiveStock(products));
}
