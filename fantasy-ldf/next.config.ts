import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Content-Security-Policy is NOT here: it carries a per-request nonce, so it
// is built and enforced in src/proxy.ts. Headers that are the same for every
// request stay below.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

// Browser source maps are never shipped. They are only worth generating when
// there is a Sentry token to upload them with — and even then they are deleted
// from the build output once uploaded, so nothing readable reaches /_next.
const uploadsSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

const nextConfig: NextConfig = {
  // Stray lockfile in the user home dir confuses workspace-root inference.
  turbopack: { root: __dirname },
  // Explicit rather than implicit: without an upload token nothing generates
  // maps at all. (Left unset when uploading, so Sentry can turn generation on.)
  ...(uploadsSourceMaps ? {} : { productionBrowserSourceMaps: false }),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  /**
   * Browser events go out through our own origin instead of sentry.io, which
   * ad blockers block by domain — without this a share of real users report
   * nothing at all, silently.
   *
   * A fixed path rather than `true` (which mints a random one per build) so
   * proxy.ts can let it through without a session: errors on /login matter as
   * much as the rest, and the middleware would otherwise bounce them. Keep
   * this value in step with TUNNEL_PATH there.
   */
  tunnelRoute: "/ldf-monitoring",
  // Source maps upload only when an auth token is present (prod/CI); the
  // build works fine without it.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !uploadsSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
});

