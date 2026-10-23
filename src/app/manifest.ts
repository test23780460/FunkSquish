import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4faff",
    theme_color: "#e4f3ff",
    icons: [
      { src: "/brand/funksquish-logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/funksquish-logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
