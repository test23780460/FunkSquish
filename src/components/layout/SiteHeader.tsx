"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mainNav, siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { CloseIcon, MenuIcon, TikTokIcon, ArrowRightIcon } from "@/components/icons/Icons";
import { CartButton } from "@/components/cart/Cart";

const dotColors = ["bg-sky", "bg-berry", "bg-grape", "bg-peach", "bg-mint"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape to close, lock page scroll and move focus into the menu while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4" style={{ viewTransitionName: "site-header" }}>
      <a
        href="#main"
        className="sr-only rounded-full bg-royal px-4 py-2 font-display text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to content
      </a>

      <div className={cn("mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full py-2 pl-4 pr-2 shadow-[0_10px_30px_-12px_rgba(19,53,122,0.35)] ring-1 ring-sky-200/80 backdrop-blur-md sm:pl-5", open ? "bg-white" : "bg-white/85")}>
        <Link href="/" onClick={close} className="group/logo shrink-0 rounded-full" aria-label="FunkSquish home">
          <Logo size="sm" priority />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 rounded-full bg-ice/70 p-1">
            {mainNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-4 py-2 font-display text-[0.98rem] font-semibold transition-colors duration-200",
                      active
                        ? "bg-white text-royal shadow-[0_3px_0_var(--color-sky-200)]"
                        : "text-ink hover:bg-white/70 hover:text-royal",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full bg-ink px-4 py-2.5 font-display text-sm font-semibold text-white transition-transform duration-200 ease-squish hover:-translate-y-0.5 hover:bg-navy sm:inline-flex"
          >
            <TikTokIcon className="size-4" />
            Follow
            <span className="sr-only"> {siteConfig.tiktok.handle} on TikTok (opens in a new tab)</span>
          </a>

          <CartButton />

          <button
            ref={buttonRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full bg-royal text-white shadow-[0_4px_0_var(--color-navy)] transition-transform duration-200 ease-squish active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-navy)] lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 bg-ink/30 backdrop-blur-[2px] lg:hidden"
            onClick={close}
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="mx-auto mt-3 max-h-[calc(100dvh-6rem)] max-w-6xl animate-rise overflow-y-auto rounded-[2rem] bg-white p-3 shadow-[var(--shadow-float)] ring-1 ring-sky-200 lg:hidden"
          >
            <nav aria-label="Mobile">
              <ul className="grid gap-1.5">
                {mainNav.map((item, i) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-2xl px-4 font-display text-xl font-semibold transition-colors",
                          active ? "bg-ice text-royal" : "text-ink hover:bg-ice-50 active:bg-ice",
                        )}
                      >
                        <span aria-hidden="true" className={cn("size-3 rounded-full ring-2 ring-white", dotColors[i % dotColors.length])} />
                        {item.label}
                        <ArrowRightIcon className="ml-auto size-5 text-sky-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <a
              href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="mt-3 flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-ink font-display text-lg font-semibold text-white"
            >
              <TikTokIcon className="size-5" />
              Follow {siteConfig.tiktok.handle}
              <span className="sr-only"> on TikTok (opens in a new tab)</span>
            </a>
          </div>
        </>
      )}
    </header>
  );
}
