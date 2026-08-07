import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { APP_NAME } from "@/lib/config";

/**
 * Reading the locale makes this a dynamic route rather than a cached one, so
 * the install prompt matches the language the user picked.
 *
 * Caveat: browsers fetch `rel="manifest"` without credentials unless the link
 * carries `crossorigin="use-credentials"`, so the locale cookie may not arrive
 * and this can fall back to Spanish. The strings are translated either way.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [t, locale] = await Promise.all([
    getTranslations("common"),
    getLocale(),
  ]);

  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: t("appDescription"),
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: locale,
    dir: "ltr",
    background_color: "#0f0f23",
    theme_color: "#0f0f23",
    categories: ["sports", "games"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
