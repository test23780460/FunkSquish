import Link from "next/link";
import { cn } from "@/lib/cn";

/** Private owner area navigation. Big touch targets; scrolls sideways on small phones. */
const LINKS = [
  { href: "/partners/review/today", label: "Today" },
  { href: "/partners/review/inventory", label: "Inventory" },
  { href: "/partners/review/orders", label: "Orders" },
  { href: "/partners/review", label: "Partners" },
] as const;

export function OwnerNav({ current }: { current: (typeof LINKS)[number]["href"] | "security" }) {
  return (
    <nav aria-label="Owner area" className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 font-display font-semibold ring-1 ring-inset",
                current === l.href ? "bg-royal text-white ring-royal" : "bg-white text-ink ring-sky-200 hover:bg-ice",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
