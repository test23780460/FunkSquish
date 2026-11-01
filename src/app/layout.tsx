import type { Metadata, Viewport } from "next";
import { launchCopy } from "@/content/launch";
import { Fredoka, Nunito } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HideInOwnerArea } from "@/components/layout/HideInOwnerArea";
import { siteConfig } from "@/lib/site";
import { features } from "@/lib/features";
import { Analytics } from "@/components/analytics/Analytics";
import { CartProvider } from "@/components/cart/Cart";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline} ${launchCopy.titleSuffix}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  // Google Search Console HTML-tag verification (optional; set in Netlify env).
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

/** The cart only exists when hosted checkout is switched on (see lib/features.ts). */
const cartEnabled = features.commerce && features.checkoutMode === "hosted-checkout";

export const viewport: Viewport = {
  themeColor: "#e4f3ff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {cartEnabled ? (
          <CartProvider>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <HideInOwnerArea>
              <SiteFooter />
            </HideInOwnerArea>
          </CartProvider>
        ) : (
          <>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <HideInOwnerArea>
              <SiteFooter />
            </HideInOwnerArea>
          </>
        )}
        <Analytics />
      </body>
    </html>
  );
}
