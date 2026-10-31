import type { NextConfig } from "next";
import { CANONICAL_ORIGIN, NETLIFY_PRODUCTION_HOST } from "./src/lib/indexing";

/** Conservative security headers that don't affect site features. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /**
   * Netlify's CONTEXT ("production", "deploy-preview", ...) only exists during the
   * build, not in the server functions that re-render pages later. Freeze it into
   * the bundle so re-rendered pages make the same integration decisions.
   */
  env: {
    BUILD_CONTEXT: process.env.CONTEXT ?? "",
    // This deploy's own URL (previews), used for links in owner notification emails.
    BUILD_DEPLOY_URL: process.env.DEPLOY_PRIME_URL ?? "",
  },
  async redirects() {
    return [
      // The production site is also reachable at its Netlify subdomain: send that to the one canonical domain.
      // (Deploy previews and branch deploys have different hostnames, so they're unaffected.)
      {
        source: "/:path*",
        has: [{ type: "host", value: NETLIFY_PRODUCTION_HOST.replace(/\./g, "\\.") }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private owner area: never indexed, never cached.
      ...["/partners/review", "/partners/review/:path*"].map((source) => ({
        source,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      })),
      // "Add to calendar" files are downloads, not pages.
      { source: "/tiktok-live/calendar/:id", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  // Owner uploads (product photos, backups) go through server actions; Netlify functions accept about 6 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
