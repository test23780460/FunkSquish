import Link from "next/link";
import { footerNav, siteConfig } from "@/lib/site";
import { Logo } from "./Logo";
import { Container } from "@/components/ui/Primitives";
import { MailIcon, TikTokIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { Wave, Sparkle } from "@/components/decor/Decor";

async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto text-white">
      <Wave fill="#13357a" className="pointer-events-none relative -mb-px -mt-10 sm:-mt-16 lg:-mt-20" />
      <div className="relative overflow-hidden bg-navy">
        <Sparkle className="left-[8%] top-10 size-4" />
        <Sparkle className="right-[12%] top-24 size-3" delay={1.4} color="#b4deff" />

        <Container className="relative grid gap-12 pb-10 pt-6 sm:pt-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="group/logo inline-block rounded-full" aria-label="FunkSquish home">
              <Logo invert size="md" />
            </Link>
            <p className="mt-4 max-w-sm text-lg leading-relaxed text-sky-200">
              Colorful, cute, and seriously satisfying squishies — coming soon from a brand-new small business.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={siteConfig.tiktok.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-display font-semibold text-ink transition-transform duration-200 ease-squish hover:-translate-y-0.5"
              >
                <TikTokIcon className="size-5" />
                {siteConfig.tiktok.handle}
                <span className="sr-only"> on TikTok (opens in a new tab)</span>
              </a>
              <a
                href={`mailto:${siteConfig.email}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-5 font-display font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/15"
              >
                <MailIcon className="size-5" />
                Email us
              </a>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerNav.map((group) => (
              <div key={group.title}>
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-sky-300">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="inline-flex min-h-10 items-center rounded-lg text-[1.05rem] text-white/90 transition-colors hover:text-white hover:underline hover:decoration-sky-300 hover:decoration-2 hover:underline-offset-4"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </Container>

        <Container className="relative">
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/15 py-6 text-sm text-sky-200 sm:flex-row">
            <p>
              © <CopyrightYear /> {siteConfig.name}. All rights reserved.
            </p>
            <p className="flex items-center gap-2">
              <Mascot className="size-7" mood="happy" />
              Made with lots of squish.
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
