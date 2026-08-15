import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalDocView } from "@/components/legal/legal-doc-view";
import { PRIVACY_DOC } from "@/content/legal/privacy";
import { getSessionUser } from "@/lib/supabase/user";

/**
 * Deliberately outside the (app) group and public in the proxy: the register
 * screen has to be able to link here before anyone has an account, and a
 * privacy policy you must log in to read is no policy at all.
 */
function pick(locale: string) {
  return locale === "en" ? PRIVACY_DOC.en : PRIVACY_DOC.es;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(locale).title };
}

export default async function PrivacyPage() {
  const [locale, user] = await Promise.all([getLocale(), getSessionUser()]);
  return (
    <LegalDocView doc={pick(locale)} backHref={user ? "/more" : "/login"} />
  );
}
