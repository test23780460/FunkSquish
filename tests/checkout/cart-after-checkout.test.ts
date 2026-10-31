import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import {
  CART_STORAGE_KEY,
  MAX_PENDING_CHECKOUTS,
  PENDING_CHECKOUT_TTL_MS,
  checkoutStartProblem,
  clearPaidCheckout,
  isStaleDeployError,
  pendingCheckoutsKey,
  rememberPendingCheckout,
  removePaidLines,
  trackCartChange,
} from "@/components/cart/cart-checkout";

const A = "11111111-2222-3333-4444-555555555555";
const B = "99999999-8888-7777-6666-555555555555";
const T0 = Date.parse("2026-10-31T12:00:00Z");
const K = CART_STORAGE_KEY;

/** One localStorage shared by every "tab" in a test (as in a real browser). */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
type S = ReturnType<typeof memoryStorage>;
const line = (variantId: string, quantity: number) => ({ variantId, productName: "P", variantName: "V", price: null, quantity });
type Line = ReturnType<typeof line>;
const cartIn = (s: S): Line[] | null => JSON.parse(s.getItem(K) ?? "null");
const pendingIds = (s: S) => Object.keys(JSON.parse(s.getItem(pendingCheckoutsKey(K)) ?? "{}"));

/** What the cart drawer does: save the cart, then lower the pending records to it. */
function saveCart(s: S, cart: Line[], now = T0) {
  s.setItem(K, JSON.stringify(cart));
  trackCartChange(s, K, cart, now);
}
/** What the result page does, only for a server-verified PAID checkout. */
function paid(s: S, id: string, now = T0) {
  return clearPaidCheckout(s, K, id, cartIn(s) ?? [], now);
}
const start = (s: S, id: string, cart: Line[], now = T0) => rememberPendingCheckout(s, K, id, cart, now);

describe("several pending checkouts (start one, go Back, start another)", () => {
  it("checkout A paid after checkout B was started: A's items are still removed (review finding on #23)", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 2)]);
    start(s, A, [line("a", 2)]);
    saveCart(s, [line("a", 2), line("b", 1)]); // back from Stripe, added b
    start(s, B, [line("a", 2), line("b", 1)]);
    expect(paid(s, A)).toEqual([line("b", 1)]);
    expect(cartIn(s)).toEqual([line("b", 1)]);
    expect(pendingIds(s)).toEqual([B]);
  });

  it("both paid, in either order: shared units are removed once, and nothing more", () => {
    for (const order of [
      [A, B],
      [B, A],
    ]) {
      const s = memoryStorage();
      saveCart(s, [line("a", 2), line("b", 1)]);
      start(s, A, [line("a", 2)].concat([line("b", 1)]));
      start(s, B, [line("a", 2), line("b", 1)]);
      paid(s, order[0]);
      expect(cartIn(s)).toEqual([]);
      saveCart(s, [line("a", 1)]); // shopper adds another 'a' afterwards
      expect(paid(s, order[1])).toEqual([line("a", 1)]); // the later confirmation can't take the new one
      expect(pendingIds(s)).toEqual([]);
    }
  });

  it("only the paid checkout's units go: an unpaid (canceled/abandoned) checkout never clears anything", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 1)]);
    start(s, A, [line("a", 1)]);
    saveCart(s, [line("a", 1), line("c", 3)]);
    start(s, B, [line("a", 1), line("c", 3)]);
    // A was canceled (its result page shows "canceled" and never calls paid()); B is paid.
    expect(paid(s, B)).toEqual([]);
    expect(paid(s, A)).toEqual([]); // even if A were later confirmed, nothing left to take
  });

  it("units added after checkout started are kept", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 2)]);
    start(s, A, [line("a", 2)]);
    saveCart(s, [line("a", 3), line("b", 1)]); // another tab added one more 'a' and a 'b'
    expect(paid(s, A)).toEqual([line("a", 1), line("b", 1)]);
  });

  it("units removed and re-added after checkout started are treated as new (never over-removed)", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 2)]);
    start(s, A, [line("a", 2)]);
    saveCart(s, [line("a", 1)]);
    saveCart(s, [line("a", 2)]);
    expect(paid(s, A)).toEqual([line("a", 1)]);
  });

  it("a reload of the result page removes nothing more", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 2)]);
    start(s, A, [line("a", 2)]);
    expect(paid(s, A)).toEqual([]);
    saveCart(s, [line("a", 1)]);
    expect(paid(s, A)).toBeNull();
    expect(cartIn(s)).toEqual([line("a", 1)]);
  });

  it("a checkout this browser didn't start (e.g. a link opened elsewhere) changes nothing", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 2)]);
    start(s, A, [line("a", 2)]);
    expect(paid(s, B)).toBeNull();
    expect(paid(s, "")).toBeNull();
    expect(cartIn(s)).toEqual([line("a", 2)]);
    expect(pendingIds(s)).toEqual([A]);
  });

  it("two tabs share the records: a change in one tab protects units the other confirms later", () => {
    const s = memoryStorage(); // same localStorage for both tabs
    saveCart(s, [line("a", 2)]); // tab 1
    start(s, A, [line("a", 2)]); // tab 1 goes to Stripe
    saveCart(s, [line("a", 0 + 1)]); // tab 2 lowers 'a' to 1
    saveCart(s, [line("a", 3)]); // tab 2 adds 2 more
    expect(paid(s, A)).toEqual([line("a", 2)]); // tab 1's result page removes only the 1 unit left from before
  });

  it("the cart drawer lowers records on every save and other tabs reload the cart", () => {
    const src = readFileSync("src/components/cart/Cart.tsx", "utf8");
    const save = src.slice(src.indexOf("function save("), src.indexOf("const onStorage"));
    expect(save).toMatch(/localStorage\.setItem\(storageKey[\s\S]*trackCartChange\(localStorage, storageKey, next\)/);
    expect(src).toMatch(/addEventListener\("storage", onStorage\)/);
    // The result page works from the stored cart (the shared truth), not a possibly stale copy in this tab.
    const clear = src.slice(src.indexOf("export function clearCartAfterPaidCheckout"));
    expect(clear).toMatch(/const stored = sanitize\(JSON\.parse\(localStorage\.getItem\(key\)/);
  });
});

describe("pending records are bounded, and damaged or blocked storage is safe", () => {
  it("keeps only the newest records", () => {
    const s = memoryStorage();
    const ids = Array.from({ length: MAX_PENDING_CHECKOUTS + 5 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);
    ids.forEach((id, i) => start(s, id, [line("a", 1)], T0 + i));
    expect(pendingIds(s).sort()).toEqual(ids.slice(5).sort());
  });

  it("forgets records after 24 hours; a confirmation for a forgotten checkout keeps the cart", () => {
    const s = memoryStorage();
    saveCart(s, [line("a", 1)]);
    start(s, A, [line("a", 1)]);
    const later = T0 + PENDING_CHECKOUT_TTL_MS + 1;
    expect(paid(s, A, later)).toBeNull();
    expect(cartIn(s)).toEqual([line("a", 1)]);
    trackCartChange(s, K, [line("a", 1)], later);
    expect(pendingIds(s)).toEqual([]); // cleaned up on the next cart change
  });

  it("treats damaged data as no record", () => {
    for (const junk of ["{not json", "[]", "null", '{"x":1}', JSON.stringify({ [A]: { units: { a: -1 }, startedAt: "x" } })]) {
      const s = memoryStorage({ [pendingCheckoutsKey(K)]: junk, [K]: JSON.stringify([line("a", 2)]) });
      expect(paid(s, A)).toBeNull();
      expect(cartIn(s)).toEqual([line("a", 2)]);
    }
    // A record with a bad count is kept without that item, so it can't remove it.
    const s = memoryStorage({
      [pendingCheckoutsKey(K)]: JSON.stringify({ [A]: { units: { a: 1.5, b: 1 }, startedAt: T0 } }),
      [K]: JSON.stringify([line("a", 2), line("b", 1)]),
    });
    expect(paid(s, A)).toEqual([line("a", 2)]);
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => rememberPendingCheckout(blocked, K, A, [line("a", 1)])).not.toThrow();
    expect(() => trackCartChange(blocked, K, [line("a", 1)])).not.toThrow();
    expect(clearPaidCheckout(blocked, K, A, [line("a", 2)])).toBeNull();
  });

  it("ignores checkout ids that aren't ours", () => {
    const s = memoryStorage();
    start(s, "<script>", [line("a", 1)]);
    expect(s.getItem(pendingCheckoutsKey(K))).toBeNull();
  });

  it("removePaidLines never goes below zero", () => {
    expect(removePaidLines([line("a", 1), line("b", 2)], [{ variantId: "a", quantity: 5 }, { variantId: "b", quantity: 1 }])).toEqual([line("b", 1)]);
  });
});

describe("only a server-verified paid checkout clears the cart", () => {
  it("the result pages clear the cart only in the verified 'paid' branch (never canceled, failed, processing or unverified)", () => {
    for (const page of ["src/app/checkout/complete/page.tsx", "src/app/checkout/test-result/page.tsx"]) {
      const src = readFileSync(page, "utf8");
      expect(src.split("<ClearPaidCart").length - 1, page).toBe(1);
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
