import * as Sentry from "@sentry/nextjs";
import { readConsentCookie } from "@/lib/consent";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Error reporting in the browser is opt-in.
 *
 * A report carries the visitor's IP address to a processor abroad, which is
 * exactly the kind of optional processing consent exists for — so nothing
 * starts until the cookie banner has been answered with "all". Reading the
 * cookie here rather than gating a component is what makes it real: this file
 * runs before any application code, so an unconsented visitor never has a
 * reporter running at all, instead of one that was started and then muzzled.
 */
const consented = readConsentCookie() === "all";

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && consented,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  // Explicit rather than inherited: this is the switch that decides whether
  // IPs, cookies and request headers ride along with an error, and it should
  // never move because a dependency changed its default.
  sendDefaultPii: false,
});

// Lets Sentry tie client-side navigations to errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
