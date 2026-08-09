// Placeholder brand name — change here once the real name is decided.
export const APP_NAME = "Fantasy LDF";

export const APP_TAGLINE_KEY = "common.tagline";

/**
 * The one origin the app calls its own — used for metadata, OG images, and the
 * links inside auth emails.
 *
 * Deliberately an environment variable rather than the request's Origin
 * header: that header is supplied by whoever makes the request, and it ends up
 * inside password-recovery links. A forged one would mail the user a recovery
 * token pointing at someone else's domain. Production must set this (the OG
 * metadata in app/layout.tsx already depends on it).
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel sets this to the stable production domain. Falling back to it means
  // a deploy that forgot the variable still mails working links, instead of
  // pointing every recovery email at localhost.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
