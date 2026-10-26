import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/indexing";

/**
 * Everything may be crawled. Pages that shouldn't appear in search use a
 * noindex tag instead: blocking them here would hide that tag from Google,
 * which can then index the bare URL ("Indexed, though blocked by robots.txt").
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
