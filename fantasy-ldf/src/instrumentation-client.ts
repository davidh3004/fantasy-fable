import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
});

// Lets Sentry tie client-side navigations to errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
