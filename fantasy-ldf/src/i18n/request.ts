import { getRequestConfig } from "next-intl/server";

// Spanish-first. When more locales are added, resolve the locale from a
// cookie or the user profile here instead of hardcoding it.
export const DEFAULT_LOCALE = "es";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
