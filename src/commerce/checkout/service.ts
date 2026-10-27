import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { stripeTestConfig, type StripeLiveConfig, type StripeTestConfig } from "./environment";
import { stripeLiveConfig } from "./live";
import { TEST_FIXTURE_PRODUCTS, TEST_SHIPPING_ORIGINS, isTestFixtureVariant } from "./test-fixtures";
import { normalizeCartLines, validateCartAgainstCatalog, type CheckedLine } from "./validate-cart";
import { quoteShipping, type BlockedLine, type QuoteResult } from "./shipping-quote";
import { SHIPPING_ORIGINS, type ShippingOrigin } from "../origins";
import { assertSession, buildCheckoutSessionParams, createStripeLiveClient, createStripeTestClient, SESSION_LIFETIME_SECONDS, type StripeMode } from "./stripe";
import { releaseStock, reserveStock } from "../orders/inventory";
import { getLiveOrderStore, getTestOrderStore, type KvStore } from "../orders/store";
import { snapshotFromStripeSession } from "../orders/session-snapshot";
import { brevoMailer, notifyPaidOrder, type NotifyConfig } from "../orders/notify";
import { checkCheckoutRateLimit } from "./rate-limit";
import type { OrderDeps } from "../orders/fulfill";
import { canPurchase, listProducts } from "../catalog";
import type { Product, ProductVariant } from "../types";
import { siteConfig } from "@/lib/site";

/**
 * Server-side checkout wiring for both Stripe modes. Every entry point
 * re-checks its mode's lock (environment.ts / live.ts), so the test path can't
 * run on production and the live path can't run anywhere else — and the live
 * path stays shut until the code switch, the env switch and live keys exist.
 */

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

interface ModeRuntime {
  mode: StripeMode;
  stripe: Stripe;
  store: KvStore;
  config: StripeTestConfig | StripeLiveConfig;
  products: Product[];
  /** Shipping origins for this mode: made-up test origins in test mode, the real ones live. */
  origins: ShippingOrigin[];
  isSellable(product: Product, variant: ProductVariant): boolean;
}

const checkoutKey = (checkoutId: string) => `checkout/${checkoutId}`;

function onHandIn(products: Product[]) {
  return (variantId: string): number | null => {
    for (const p of products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return v.inventory.tracked ? v.inventory.available : null;
    }
    return null;
  };
}

async function runtimeFor(mode: StripeMode): Promise<ModeRuntime | null> {
  if (mode === "test") {
    const config = stripeTestConfig();
    if (!config) return null;
    return {
      mode,
      config,
      stripe: createStripeTestClient(config),
      store: await getTestOrderStore(),
      products: TEST_FIXTURE_PRODUCTS,
      origins: TEST_SHIPPING_ORIGINS,
      isSellable: (_p, v) => isTestFixtureVariant(v.id),
    };
  }
  const config = stripeLiveConfig();
  if (!config) return null;
  return {
    mode,
    config,
    stripe: createStripeLiveClient(config),
    store: await getLiveOrderStore(),
    products: await listProducts(),
    origins: SHIPPING_ORIGINS,
    isSellable: canPurchase,
  };
}

/** Which mode (if any) is open here. Live wins only when its every lock is open — which also means it's production. */
export function activeMode(): StripeMode | null {
  if (stripeLiveConfig()) return "live";
  if (stripeTestConfig()) return "test";
  return null;
}

export function notifyConfigFor(mode: StripeMode, origin: string): NotifyConfig {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM || process.env.PARTNER_NOTIFY_FROM || null;
  return {
    mailer: key && from ? brevoMailer(key, from) : null,
    ownerEmail: process.env.ORDER_NOTIFY_EMAIL || process.env.PARTNER_NOTIFY_EMAIL || null,
    ownerOrdersUrl: `${origin}/partners/review/orders`,
    sendInTestMode: mode === "test" && process.env.STRIPE_TEST_SEND_EMAILS === "true",
    siteUrl: siteConfig.url,
    contactEmail: siteConfig.email,
  };
}

async function retrieveSnapshot(stripe: Stripe, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const items = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100, expand: ["data.price.product"] });
  return snapshotFromStripeSession({ ...session, line_items: items } as Stripe.Checkout.Session);
}

function depsFrom(rt: ModeRuntime): OrderDeps {
  const notify = notifyConfigFor(rt.mode, rt.config.returnOrigin);
  return {
    store: rt.store,
    mode: rt.mode,
    retrieveSession: (id) => retrieveSnapshot(rt.stripe, id),
    onHand: onHandIn(rt.products),
    now: () => new Date(),
    afterPaid: (order) => notifyPaidOrder(rt.store, order, notify),
  };
}

/** Order-processing dependencies for a mode, or null if that mode isn't open here. */
export async function orderDeps(mode: StripeMode): Promise<(OrderDeps & { stripe: Stripe }) | null> {
  const rt = await runtimeFor(mode);
  return rt ? { ...depsFrom(rt), stripe: rt.stripe } : null;
}

/** Kept for the existing test webhook route and tests. */
export async function orderDepsFor(config: StripeTestConfig): Promise<OrderDeps> {
  const rt: ModeRuntime = {
    mode: "test",
    config,
    stripe: createStripeTestClient(config),
    store: await getTestOrderStore(),
    products: TEST_FIXTURE_PRODUCTS,
    origins: TEST_SHIPPING_ORIGINS,
    isSellable: (_p, v) => isTestFixtureVariant(v.id),
  };
  return depsFrom(rt);
}

const quoteLines = (lines: CheckedLine[]) =>
  lines.map((l) => ({
    variantId: l.variantId,
    name: l.name,
    quantity: l.quantity,
    fulfillmentSource: l.fulfillmentSource,
    fulfillmentOrigin: l.fulfillmentOrigin,
    weightGrams: l.weightGrams,
    statedProcessingDays: l.statedProcessingDays,
  }));

function logBlocked(mode: StripeMode, blocked: BlockedLine[]) {
  // Owner-facing reasons only (no shopper data): which origin isn't ready and why.
  for (const b of blocked) console.warn(`[stripe-${mode}] shipping blocked for ${b.variantId}: ${b.ownerDetail}`);
}

export type CartQuote =
  | {
      ok: true;
      subtotal: number;
      shipping: number;
      /** Subtotal + shipping. Sales tax (if any) is added on Stripe's page, which shows the final total before paying. */
      totalBeforeTax: number;
      packages: { label: string; units: number; cents: number; shipsWithinBusinessDays: number }[];
    }
  | { ok: false; error: string; blocked: { variantId: string; message: string }[] };

/** What the cart shows before checkout: the same calculation checkout will use. */
async function quoteCartIn(rt: ModeRuntime, rawLines: unknown): Promise<CartQuote> {
  const normalized = normalizeCartLines(rawLines);
  if (!normalized.ok) return { ok: false, error: normalized.message, blocked: [] };
  const checked = validateCartAgainstCatalog(normalized.value, rt.products, rt.isSellable);
  if (!checked.ok) return { ok: false, error: checked.message, blocked: [] };
  const q: QuoteResult = quoteShipping(quoteLines(checked.value), rt.origins, new Date());
  if (!q.ok) return { ok: false, error: q.message, blocked: q.blocked.map((b) => ({ variantId: b.variantId, message: b.message })) };
  const subtotal = checked.value.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
  return {
    ok: true,
    subtotal,
    shipping: q.quote.totalCents,
    totalBeforeTax: subtotal + q.quote.totalCents,
    packages: q.quote.packages.map((p) => ({ label: p.label, units: p.units, cents: p.cents, shipsWithinBusinessDays: p.processingBusinessDays })),
  };
}

/**
 * `client` is the request's headers (null outside a web request). Requests are
 * counted only while a checkout mode is open, so the closed shop stores nothing.
 */
export async function quoteCart(rawLines: unknown, client: Pick<Headers, "get"> | null = null): Promise<CartQuote> {
  const mode = activeMode();
  if (!mode) return { ok: false, error: "Checkout isn't open yet.", blocked: [] };
  const limited = await checkCheckoutRateLimit("quote", client);
  if (!limited.ok) return { ok: false, error: limited.message, blocked: [] };
  const rt = await runtimeFor(mode);
  return rt ? quoteCartIn(rt, rawLines) : { ok: false, error: "Checkout isn't open yet.", blocked: [] };
}

async function startCheckoutIn(rt: ModeRuntime, rawLines: unknown): Promise<StartCheckoutResult> {
  const normalized = normalizeCartLines(rawLines);
  if (!normalized.ok) return { ok: false, error: normalized.message };
  const checked = validateCartAgainstCatalog(normalized.value, rt.products, rt.isSellable);
  if (!checked.ok) return { ok: false, error: checked.message };

  // Shipping is priced here, on the server, before any stock is held. Items whose
  // shipping can't be quoted from verified rates are refused (never guessed).
  const shipping = quoteShipping(quoteLines(checked.value), rt.origins, new Date());
  if (!shipping.ok) {
    logBlocked(rt.mode, shipping.blocked);
    return { ok: false, error: shipping.message };
  }

  const onHand = onHandIn(rt.products);
  const checkoutId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_LIFETIME_SECONDS;

  const reserved = await reserveStock(
    rt.store,
    checkoutId,
    checked.value.map((l) => ({ variantId: l.variantId, quantity: l.quantity, onHand: onHand(l.variantId) ?? 0 })),
    expiresAt,
    now,
  );
  if (!reserved.ok) {
    const line = checked.value.find((l) => l.variantId === reserved.variantId);
    return {
      ok: false,
      error:
        reserved.available > 0
          ? `Only ${reserved.available} of ${line?.name ?? "an item"} can be ordered right now. Please lower the quantity.`
          : `${line?.name ?? "An item"} just sold out. Please remove it to continue.`,
    };
  }

  try {
    const session = await rt.stripe.checkout.sessions.create(
      buildCheckoutSessionParams({ lines: checked.value, checkoutId, config: rt.config, shipping: shipping.quote, expiresAt, mode: rt.mode }),
      { idempotencyKey: `funksquish-checkout-${checkoutId}` },
    );
    const url = assertSession(session, rt.mode);
    await rt.store.create(checkoutKey(checkoutId), { sessionId: session.id });
    return { ok: true, url };
  } catch (err) {
    await releaseStock(rt.store, checkoutId);
    // Log the error class/code only — Stripe messages can echo request data.
    const code = (err as { code?: string; type?: string })?.code ?? (err as { type?: string })?.type ?? "unknown";
    console.error(`[stripe-${rt.mode}] checkout session failed:`, code);
    return { ok: false, error: "We couldn't start checkout. Nothing was charged — please try again in a moment." };
  }
}

async function startIn(mode: StripeMode, rawLines: unknown, client: Pick<Headers, "get"> | null): Promise<StartCheckoutResult> {
  if (!(mode === "live" ? stripeLiveConfig() : stripeTestConfig())) return { ok: false, error: "Checkout isn't open yet." };
  // Before anything is read, held or sent to Stripe.
  const limited = await checkCheckoutRateLimit("start", client);
  if (!limited.ok) return { ok: false, error: limited.message };
  const rt = await runtimeFor(mode);
  return rt ? startCheckoutIn(rt, rawLines) : { ok: false, error: "Checkout isn't open yet." };
}

/** `client` is the request's headers (null outside a web request). */
export async function startTestCheckout(rawLines: unknown, client: Pick<Headers, "get"> | null = null): Promise<StartCheckoutResult> {
  return startIn("test", rawLines, client);
}

export async function startLiveCheckout(rawLines: unknown, client: Pick<Headers, "get"> | null = null): Promise<StartCheckoutResult> {
  return startIn("live", rawLines, client);
}

/**
 * Shopper pressed "back" on Stripe's page. Expire the session so it can't be
 * paid later, then free the stock. Safe to call repeatedly.
 */
async function cancelCheckoutIn(rt: ModeRuntime, checkoutId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(checkoutId)) return;
  const link = await rt.store.get<{ sessionId: string }>(checkoutKey(checkoutId));
  if (link) {
    try {
      const session = await rt.stripe.checkout.sessions.retrieve(link.value.sessionId);
      if (session.status === "open") await rt.stripe.checkout.sessions.expire(link.value.sessionId);
      if (session.status === "complete") return; // already paid — never release
    } catch {
      return; // leave the hold; it expires on its own at expires_at
    }
  }
  await releaseStock(rt.store, checkoutId);
}

export async function cancelTestCheckout(checkoutId: string): Promise<void> {
  const rt = await runtimeFor("test");
  if (rt) await cancelCheckoutIn(rt, checkoutId);
}

export async function cancelLiveCheckout(checkoutId: string): Promise<void> {
  const rt = await runtimeFor("live");
  if (rt) await cancelCheckoutIn(rt, checkoutId);
}
