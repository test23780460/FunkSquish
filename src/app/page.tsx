import type { Metadata } from "next";
import { jsonLdScript, siteJsonLd } from "@/lib/seo";
import { PageTransition } from "@/components/layout/PageTransition";
import { Hero } from "@/components/home/Hero";
import { Collections } from "@/components/home/Collections";
import { WhyFunkSquish } from "@/components/home/WhyFunkSquish";
import { SquishLabTeaser } from "@/components/home/SquishLabTeaser";
import { TikTokLiveSection } from "@/components/home/TikTokLiveSection";
import { LaunchSection } from "@/components/home/LaunchSection";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(siteJsonLd())} />
      <Hero />
      <Collections />
      <SquishLabTeaser />
      <WhyFunkSquish />
      <TikTokLiveSection />
      <LaunchSection />
    </PageTransition>
  );
}
