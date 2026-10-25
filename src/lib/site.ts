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
  /** Legal operator (owner-approved Oct 24, 2026). */
  legalOperator: "Travis Phillips, a sole proprietor doing business as FunkSquish",
  /** Business mailing address (owner-approved; required in marketing emails by CAN-SPAM). */
  mailingAddress: ["FunkSquish", "207 Towne Dr, Unit #1029", "Elizabethtown, KY 42701"],
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
  { label: "Squish Lab", href: "/squish-lab" },
  { label: "New Drops", href: "/drops" },
  { label: "TikTok LIVE", href: "/tiktok-live" },
  { label: "Our Story", href: "/our-story" },
];

/** Extra links shown in the mobile menu and footer. */
export const exploreNav: NavItem[] = [
  { label: "Squish Lab", href: "/squish-lab" },
  { label: "Personality quiz", href: "/quiz" },
  { label: "Build a Squish Box", href: "/squish-box" },
  { label: "My wishlist", href: "/wishlist" },
  { label: "FAQ", href: "/faq" },
  { label: "Become a partner", href: "/partners" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "Home", href: "/" },
      { label: "Shop preview", href: "/shop" },
      { label: "Squish Lab", href: "/squish-lab" },
      { label: "Personality quiz", href: "/quiz" },
      { label: "Squish Box builder", href: "/squish-box" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "New drops", href: "/drops" },
      { label: "TikTok LIVE", href: "/tiktok-live" },
    ],
  },
  {
    title: "FunkSquish",
    items: [
      { label: "About", href: "/our-story" },
      { label: "Become a partner", href: "/partners" },
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
