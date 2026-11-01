/**
 * TikTok Shop API — the shape of a future adapter. NOT CONNECTED.
 *
 * Today TikTok Shop is reconciled by hand: record sales one by one (or during
 * a LIVE), or upload Seller Center's order export (src/commerce/orders/reconcile.ts).
 * If TikTok Shop Partner API access is approved for FunkSquish later, an
 * adapter implementing this interface could:
 *   - pull new and canceled orders (each line still recorded once, through
 *     the same claim used by the CSV import, so CSV and API never double-count);
 *   - push this site's "free" stock count to TikTok listings (this site's
 *     ledger stays the single authoritative count);
 *   - mark listings unavailable when the website pauses an item.
 * Conflicts: the ledger wins. A TikTok sale for units the website already
 * sold is held for the owner (never forced), exactly like the CSV path.
 * Late events are fine (claimed by order id + SKU). Every pull records when it
 * ran, so stale stock is visible.
 *
 * Switching it on would need: approved API access, app credentials stored as
 * Netlify secrets, a reviewed PR with the implementation, and the owner's
 * explicit approval (TIKTOK_SHOP_SYNC=on for Production). None exist.
 */
export interface TikTokShopOrderLine {
  orderId: string;
  sellerSku: string;
  quantity: number;
  canceled: boolean;
  createdAt: string;
}

export interface TikTokShopAdapter {
  /** Orders created or changed since the given time. */
  ordersSince(sinceIso: string): Promise<TikTokShopOrderLine[]>;
  /** Set the stock TikTok shows for one seller SKU. */
  setAvailable(sellerSku: string, units: number): Promise<void>;
}

export type TikTokShopStatus = { connected: false; reasons: string[] };

export function tiktokShopStatus(env: Record<string, string | undefined> = process.env): TikTokShopStatus {
  const reasons = ["no reviewed TikTok Shop adapter in this codebase"];
  if (!env.TIKTOK_SHOP_APP_KEY || !env.TIKTOK_SHOP_APP_SECRET) reasons.push("no TikTok Shop API credentials");
  if (env.TIKTOK_SHOP_SYNC !== "on") reasons.push("not approved (TIKTOK_SHOP_SYNC)");
  return { connected: false, reasons };
}
