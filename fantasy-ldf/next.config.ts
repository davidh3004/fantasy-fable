import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Content-Security-Policy is shipped Report-Only first so it can't break the
// app (Supabase XHR/WebSocket, external badge/photo images, next-themes' inline
// script, Tailwind inline styles). Tune against the violation reports, then
// switch the header key to "Content-Security-Policy" to enforce.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
].join("; ");

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
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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

