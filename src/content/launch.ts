import { purchasingEnabled } from "@/lib/features";

/**
 * Site-wide launch wording, in one place. It follows the purchasing switch
 * (src/lib/features.ts), so the day an approved launch PR turns purchasing on,
 * every "coming soon" line changes with it — no copy hunt on launch day.
 *
 * The three modes the site moves through:
 *  1. Preview — only illustrated samples (catalog-aware pages say so).
 *  2. Real products, purchasing closed — products show, "Ordering isn't open yet".
 *  3. Live — purchasing approved and on.
 * Modes 1 and 2 share the pre-launch wording below; the catalog-aware pages
 * (shop, product, quiz, Squish Box…) handle the sample-vs-real difference.
 * No launch DATE appears anywhere until one is set and announced.
 */
export interface LaunchCopy {
  /** Small badge above the homepage headline. */
  heroBadge: string;
  /** The round sticker on the homepage art (two short lines). */
  heroSticker: [string, string];
  /** Last word in the scrolling homepage ribbon. */
  marquee: string;
  /** Footer line under the logo. */
  footerTagline: string;
  /** Suffix of the default page title. */
  titleSuffix: string;
  /** Share-image (Open Graph) badge. */
  shareBadge: string;
  /** Order-help notice, or null once the shop is open. */
  orderHelpNotice: { title: string; body: string } | null;
}

export const PRE_LAUNCH: LaunchCopy = {
  heroBadge: "Coming soon",
  heroSticker: ["Coming", "soon!"],
  marquee: "Coming soon",
  footerTagline: "Colorful, cute, and seriously satisfying squishies — coming soon from a brand-new small business.",
  titleSuffix: "Squishies coming soon",
  shareBadge: "COMING SOON",
  orderHelpNotice: {
    title: "The shop isn't open yet",
    body: "No orders have been placed with FunkSquish yet. If anyone claims to sell FunkSquish products before our launch announcement on TikTok, it isn't us.",
  },
};

export const LIVE: LaunchCopy = {
  heroBadge: "Now open",
  heroSticker: ["Shop", "now!"],
  marquee: "Shop now",
  footerTagline: "Colorful, cute, and seriously satisfying squishies from a small business that loves them.",
  titleSuffix: "Squishies you'll want to squeeze",
  shareBadge: "NOW OPEN",
  orderHelpNotice: null,
};

export const launchCopy: LaunchCopy = purchasingEnabled ? LIVE : PRE_LAUNCH;
