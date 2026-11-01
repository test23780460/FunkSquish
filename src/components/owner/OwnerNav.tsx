import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Private owner area navigation: the ten dashboard sections. Big touch
 * targets; on phones it scrolls sideways (the current section is first in
 * view because it's marked and the list starts with Overview).
 *
 * Partner applications and Security live inside Suppliers and Settings, but
 * stay reachable here through those sections' own sub-navigation.
 */
export const OWNER_SECTIONS = [
  { id: "overview", href: "/partners/review/today", label: "Overview", ready: true },
  { id: "products", href: "/partners/review/products", label: "Products", ready: true },
  { id: "inventory", href: "/partners/review/inventory", label: "Inventory", ready: true },
  { id: "orders", href: "/partners/review/orders", label: "Orders", ready: true },
  { id: "suppliers", href: "/partners/review/suppliers", label: "Suppliers", ready: true },
  { id: "fulfillment", href: "/partners/review/fulfillment", label: "Fulfillment", ready: true },
  { id: "shipping", href: "/partners/review/shipping", label: "Shipping", ready: true },
  { id: "marketing", href: "/partners/review/marketing", label: "Email & marketing", ready: true },
  { id: "analytics", href: "/partners/review/analytics", label: "Analytics", ready: true },
  { id: "settings", href: "/partners/review/settings", label: "Settings", ready: true },
] as const;

export type OwnerSection = (typeof OWNER_SECTIONS)[number]["id"];

/** Older pages pass an href; partner applications belong to Suppliers, Security to Settings. */
const LEGACY: Record<string, OwnerSection> = {
  "/partners/review/today": "overview",
  "/partners/review/inventory": "inventory",
  "/partners/review/orders": "orders",
  "/partners/review": "suppliers",
  "/partners/review/security": "settings",
  security: "settings",
};

const focus = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-royal";

export function OwnerNav({ current }: { current: OwnerSection | keyof typeof LEGACY }) {
  const active: OwnerSection = (LEGACY[current] ?? current) as OwnerSection;
  return (
    <nav aria-label="Owner dashboard" className="-mx-4 mb-7 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(19,53,122,0.05),0_8px_24px_-16px_rgba(19,53,122,0.3)] ring-1 ring-sky-100 lg:w-full lg:justify-between">
        {OWNER_SECTIONS.map((l) => (
          // On phones the current section is shown first, so it's always in view without scrolling.
          <li key={l.id} className={cn(active === l.id && "order-first lg:order-none")}>
            {!l.ready ? (
              <span aria-disabled="true" title="Not built yet" className="inline-flex min-h-10 items-center whitespace-nowrap rounded-xl px-3.5 font-display text-[0.92rem] font-semibold text-ink-soft">
                {l.label}
              </span>
            ) : (
              <Link
                href={l.href}
                aria-current={active === l.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-xl px-3.5 font-display text-[0.92rem] font-semibold transition-colors motion-reduce:transition-none",
                  active === l.id ? "bg-royal text-white shadow-[0_2px_0_var(--color-navy)]" : "text-ink hover:bg-ice-50 hover:text-royal",
                  focus,
                )}
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Second-level tabs inside a section (e.g. Suppliers → Partner applications). Underlined, so they read as a different level from the main bar. */
export function OwnerSubNav({ label, items, current }: { label: string; items: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-sky-200">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={current === i.href ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-[3px] px-3 text-sm font-semibold transition-colors motion-reduce:transition-none",
                current === i.href ? "border-royal text-ink" : "border-transparent text-ink-soft hover:border-sky-300 hover:text-ink",
                focus,
              )}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const SETTINGS_TABS = [
  { href: "/partners/review/settings", label: "Settings" },
  { href: "/partners/review/settings/activity", label: "Activity log" },
  { href: "/partners/review/security", label: "Security & two-step sign-in" },
];

export const PRODUCT_TABS = [
  { href: "/partners/review/products", label: "All products" },
  { href: "/partners/review/products/releases", label: "Website catalog & rollback" },
  { href: "/partners/review/products/import", label: "Import / export" },
];

export const SUPPLIER_TABS = [
  { href: "/partners/review/suppliers", label: "Suppliers" },
  { href: "/partners/review/suppliers/compare", label: "Compare" },
  { href: "/partners/review", label: "Partner applications" },
];

export const INVENTORY_TABS = [
  { href: "/partners/review/inventory", label: "Stock" },
  { href: "/partners/review/inventory/reconcile", label: "TikTok, counts & restocks" },
  { href: "/partners/review/inventory/live", label: "TikTok LIVE" },
  { href: "/partners/review/inventory/activity", label: "Activity" },
];
