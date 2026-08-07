"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Switches the interface language.
 *
 * The choice lives in a cookie rather than the URL so no route needs a locale
 * segment, and it outlives the session for signed-out visitors too. Every
 * layout is revalidated because the translations are baked into the server
 * render — refreshing only the current path would leave stale strings in the
 * shell around it.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/", "layout");
}
