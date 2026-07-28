import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Languages,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { isAdminUser } from "@/lib/admin";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("more") };
}

export default async function MorePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [t, tAuth, tNav] = await Promise.all([
    getTranslations("more"),
    getTranslations("auth"),
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
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 opacity-50">
          <BookOpen className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("rules")}</span>
          <span className="text-xs text-muted-foreground">{t("soon")}</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
          <Languages className="size-4.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("language")}</span>
          <span className="text-xs text-muted-foreground">{t("soon")}</span>
        </div>
      </section>

      <form action={signOut} className="mt-6">
        <Button
          type="submit"
          variant="outline"
          className="h-11 w-full cursor-pointer text-destructive hover:text-destructive sm:w-auto"
        >
          <LogOut className="size-4" aria-hidden />
          {tAuth("signOut")}
        </Button>
      </form>
    </main>
  );
}
