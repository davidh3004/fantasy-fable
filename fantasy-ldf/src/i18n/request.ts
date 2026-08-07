import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

// Spanish-first: the cookie is only written when someone actively switches,
// so anyone who never touches the selector still gets Spanish.
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
