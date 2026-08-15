import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Languages,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { isAdminUser } from "@/lib/admin";
import { SignOutButton } from "@/components/more/sign-out-button";
import { DeleteAccountButton } from "@/components/more/delete-account-button";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("more") };
}

export default async function MorePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [t, tNav] = await Promise.all([
    getTranslations("more"),
    getTranslations("nav"),
  ]);

  const displayName = user.displayName || (user.email ?? "");
  const isAdmin = await isAdminUser(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-heading text-2xl">{tNav("more")}</h1>

      {/* Profile */}
      <section className="mt-6 flex items-center gap-3.5 rounded-xl border border-border bg-card p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </section>

      {/* Links */}
      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-accent"
          >
            <ShieldCheck className="size-4.5 text-cta" aria-hidden />
            <span className="flex-1 text-sm font-medium">{t("admin")}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        )}
        <Link
          href="/matches"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-accent"
        >
          <CalendarDays className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{tNav("matches")}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <Link
          href="/rules"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-accent"
        >
          <BookOpen className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("rules")}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <Link
          href="/privacy"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-accent"
        >
          <ShieldCheck className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("privacy")}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <Link
          href="/terms"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-accent"
        >
          <Scale className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("terms")}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Languages className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {t("language")}
          </span>
          <LocaleSwitcher className="shrink-0" />
        </div>
      </section>

      <div className="mt-6">
        <SignOutButton />
      </div>

      {/* Kept apart from everything else and last on the page: an irreversible
          action shouldn't sit next to the language picker. */}
      <section className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h2 className="font-heading text-base text-destructive">
          {t("dangerZone")}
        </h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">
          {t("deleteAccount.hint")}
        </p>
        <DeleteAccountButton confirmWord={t("deleteAccount.confirmWord")} />
      </section>
    </main>
  );
}
