import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalDocView } from "@/components/legal/legal-doc-view";
import { TERMS_DOC } from "@/content/legal/terms";
import { getSessionUser } from "@/lib/supabase/user";

function pick(locale: string) {
  return locale === "en" ? TERMS_DOC.en : TERMS_DOC.es;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(locale).title };
}

export default async function TermsPage() {
  const [locale, user] = await Promise.all([getLocale(), getSessionUser()]);
  return <LegalDocView doc={pick(locale)} backHref={user ? "/more" : "/login"} />;
}
