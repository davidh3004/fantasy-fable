import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Runs in the Edge runtime (proxy.ts / edge routes).
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  // Same rule as the server: report the fault, not the person. See
  // sentry.server.config.ts.
  sendDefaultPii: false,
});
