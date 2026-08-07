/**
 * Locale constants, deliberately free of any server-only import.
 *
 * The language switcher is a client component, so anything it needs must be
 * safe to bundle for the browser — `request.ts` reaches for `next/headers`,
 * which is not.
 */

export const DEFAULT_LOCALE = "es";
export const LOCALES = ["es", "en"] as const;
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}
