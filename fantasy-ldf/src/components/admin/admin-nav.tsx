"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/clubs", key: "clubs" },
  { href: "/admin/players", key: "players" },
  { href: "/admin/gameweeks", key: "gameweeks" },
  { href: "/admin/results", key: "results" },
  { href: "/admin/scoring", key: "scoring" },
  { href: "/admin/settings", key: "settings" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  return (
    <nav
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      aria-label={t("aria")}
    >
      {TABS.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
            pathname.startsWith(href)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
