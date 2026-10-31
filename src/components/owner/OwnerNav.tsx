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

export function OwnerNav({ current }: { current: OwnerSection | keyof typeof LEGACY }) {
  const active: OwnerSection = (LEGACY[current] ?? current) as OwnerSection;
  return (
    <nav aria-label="Owner dashboard" className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <ul className="flex min-w-max gap-2">
        {OWNER_SECTIONS.map((l) => (
          <li key={l.id}>
            {!l.ready ? (
              <span aria-disabled="true" title="Not built yet" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-display font-semibold text-ink-soft ring-1 ring-inset ring-sky-100">
                {l.label}
              </span>
            ) : (
            <Link
              href={l.href}
              aria-current={active === l.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-display font-semibold ring-1 ring-inset",
                active === l.id ? "bg-royal text-white ring-royal" : "bg-white text-ink ring-sky-200 hover:bg-ice",
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

/** Second-level tabs inside a section (e.g. Suppliers → Partner applications). */
export function OwnerSubNav({ label, items, current }: { label: string; items: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={current === i.href ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold",
            current === i.href ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice",
          )}
        >
          {i.label}
        </Link>
      ))}
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
