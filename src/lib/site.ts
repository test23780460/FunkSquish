/**
 * Central brand + site configuration.
 * Change things here first; components read from this file.
 */
export const siteConfig = {
  name: "FunkSquish",
  url: "https://funksquish.com",
  tagline: "Get Your Squish On!",
  description:
    "FunkSquish is a new squishy toy shop for colorful fruit slushies, jelly squishies, crunchy squishies, and cute collectibles. Coming soon!",
  email: "travis@funksquish.com",
  tiktok: {
    handle: "@FunkSquish",
    url: "https://www.tiktok.com/@funksquish",
  },
  /**
   * Official round badge logo (transparent corners).
   * Source file: assets/brand/funksquish-logo-original.webp
   */
  logo: {
    src: "/brand/funksquish-logo.webp",
    width: 1024,
    height: 1024,
    alt: "FunkSquish logo",
  },
} as const;

export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Our Story", href: "/our-story" },
  { label: "TikTok LIVE", href: "/tiktok-live" },
  { label: "FAQ", href: "/faq" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "Home", href: "/" },
      { label: "Shop preview", href: "/shop" },
      { label: "TikTok LIVE", href: "/tiktok-live" },
    ],
  },
  {
    title: "FunkSquish",
    items: [
      { label: "About", href: "/our-story" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Order help", href: "/order-help" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Care & safety", href: "/product-care" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
