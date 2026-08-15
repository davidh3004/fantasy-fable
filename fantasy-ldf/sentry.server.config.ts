import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// No DSN → Sentry stays disabled (safe in dev/CI). Set SENTRY_DSN in prod.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0, // enable/raise once you want performance tracing
  /**
   * Server-side reporting stays on without consent — it is about keeping the
   * service standing, not about the visitor, and it sets no cookies. What it
   * must not do is carry personal data along for the ride: with this off, an
   * event describes the fault and not the person who hit it, so no IP address,
   * cookie header or session token leaves the server with a stack trace.
   */
  sendDefaultPii: false,
});
