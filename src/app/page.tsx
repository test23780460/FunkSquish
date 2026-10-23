import { PageTransition } from "@/components/layout/PageTransition";
import { Hero } from "@/components/home/Hero";
import { Collections } from "@/components/home/Collections";
import { WhyFunkSquish } from "@/components/home/WhyFunkSquish";
import { TikTokLiveSection } from "@/components/home/TikTokLiveSection";
import { LaunchSection } from "@/components/home/LaunchSection";

export default function HomePage() {
  return (
    <PageTransition>
      <Hero />
      <Collections />
      <WhyFunkSquish />
      <TikTokLiveSection />
      <LaunchSection />
    </PageTransition>
  );
}
