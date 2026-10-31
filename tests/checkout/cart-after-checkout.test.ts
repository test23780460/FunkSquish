import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import {
  CART_STORAGE_KEY,
  checkoutStartProblem,
  clearPaidCheckout,
  isStaleDeployError,
  pendingCheckoutKey,
  rememberPendingCheckout,
  removePaidLines,
} from "@/components/cart/cart-checkout";

const ID = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
const line = (variantId: string, quantity: number) => ({ variantId, productName: "P", variantName: "V", price: null, quantity });
const cartIn = (s: ReturnType<typeof memoryStorage>) => JSON.parse(s.getItem(CART_STORAGE_KEY) ?? "null");

describe("the cart is cleared only after a verified paid checkout from this browser", () => {
  it("removes exactly what was paid for and keeps items added after checkout started", () => {
    expect(removePaidLines([line("a", 2), line("b", 1), line("c", 3)], [{ variantId: "a", quantity: 2 }, { variantId: "c", quantity: 1 }])).toEqual([
      line("b", 1),
      line("c", 2),
    ]);
  });

  it("clears once for the matching checkout; a reload of the result page removes nothing more", () => {
    const s = memoryStorage();
    rememberPendingCheckout(s, CART_STORAGE_KEY, ID, [{ variantId: "a", quantity: 2 }]);
    // While on Stripe, the shopper added another 'a' in another tab.
    const cart = [line("a", 3), line("b", 1)];
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, ID, cart)).toEqual([line("a", 1), line("b", 1)]);
    expect(cartIn(s)).toEqual([line("a", 1), line("b", 1)]);
    expect(s.getItem(pendingCheckoutKey(CART_STORAGE_KEY))).toBeNull();
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, ID, [line("a", 1), line("b", 1)])).toBeNull(); // reload
  });

  it("keeps the cart for a different checkout (e.g. a confirmation link opened in another browser) or with no record", () => {
    const s = memoryStorage();
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, ID, [line("a", 2)])).toBeNull();
    rememberPendingCheckout(s, CART_STORAGE_KEY, ID, [{ variantId: "a", quantity: 2 }]);
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, OTHER, [line("a", 2)])).toBeNull();
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, "", [line("a", 2)])).toBeNull();
    expect(cartIn(s)).toBeNull(); // never written
    expect(s.getItem(pendingCheckoutKey(CART_STORAGE_KEY))).not.toBeNull(); // still waiting for its own result
  });

  it("treats a damaged record as no record, and never crashes when storage is blocked", () => {
    const s = memoryStorage({ [pendingCheckoutKey(CART_STORAGE_KEY)]: "{not json" });
    expect(clearPaidCheckout(s, CART_STORAGE_KEY, ID, [line("a", 2)])).toBeNull();
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {},
    };
    expect(() => rememberPendingCheckout(blocked, CART_STORAGE_KEY, ID, [])).not.toThrow();
    expect(clearPaidCheckout(blocked, CART_STORAGE_KEY, ID, [line("a", 2)])).toBeNull();
  });

  it("ignores checkout ids that aren't ours", () => {
    const s = memoryStorage();
    rememberPendingCheckout(s, CART_STORAGE_KEY, "<script>", [{ variantId: "a", quantity: 1 }]);
    expect(s.getItem(pendingCheckoutKey(CART_STORAGE_KEY))).toBeNull();
  });

  it("the result pages clear the cart only in the verified 'paid' branch (never canceled, failed, processing or unverified)", () => {
    for (const page of ["src/app/checkout/complete/page.tsx", "src/app/checkout/test-result/page.tsx"]) {
      const src = readFileSync(page, "utf8");
      const uses = src.split("<ClearPaidCart").length - 1;
      expect(uses, page).toBe(1);
      const at = src.indexOf("<ClearPaidCart");
      expect(at, page).toBeGreaterThan(src.indexOf('case "paid":'));
      expect(at, page).toBeLessThan(src.indexOf('case "processing":'));
      // The outcome comes from fulfillCheckoutSession, which re-fetches the session from Stripe.
      expect(src, page).toContain("outcome = await fulfillCheckoutSession(sessionId, ");
    }
  });
});

describe("a checkout start that throws never leaves the button stuck", () => {
  it("recognizes a stale page after a deploy and offers a reload", () => {
    for (const err of [new UnrecognizedActionError("Server Action not found"), Object.assign(new Error("x"), { name: "UnrecognizedActionError" })]) {
      expect(isStaleDeployError(err)).toBe(true);
      const p = checkoutStartProblem(err);
      expect(p.reload).toBe(true);
      expect(p.message).toMatch(/Nothing was charged/);
      expect(p.message).toMatch(/cart is saved/);
      expect(p.message).toMatch(/Reload/);
    }
  });

  it("network failures say nothing was charged and allow a retry", () => {
    const p = checkoutStartProblem(new TypeError("Failed to fetch"));
    expect(isStaleDeployError(new TypeError("Failed to fetch"))).toBe(false);
    expect(p).toEqual({ reload: false, message: expect.stringMatching(/Nothing was charged.*cart is saved.*try again/) });
  });

  it("the cart drawer catches thrown errors, blocks double starts and recovers after Back from Stripe", () => {
    const src = readFileSync("src/components/cart/Cart.tsx", "utf8");
    const fn = src.slice(src.indexOf("async function checkout()"), src.indexOf("return (", src.indexOf("async function checkout()")));
    expect(fn).toMatch(/if \(starting\.current\) return;/);
    expect(fn).toMatch(/try \{[\s\S]*await startCheckout[\s\S]*\} catch \(err\) \{[\s\S]*checkoutStartProblem\(err\)/);
    expect(fn).toMatch(/rememberPendingCheckout\([\s\S]*\);\s*window\.location\.assign/);
    expect(src).toMatch(/addEventListener\("pageshow"/);
  });
});
