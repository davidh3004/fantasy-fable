"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Ellipsis,
  House,
  Shirt,
  Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/home", key: "home", Icon: House },
  { href: "/team", key: "team", Icon: Shirt },
  { href: "/transfers", key: "transfers", Icon: ArrowLeftRight },
  { href: "/leagues", key: "leagues", Icon: Trophy },
  { href: "/more", key: "more", Icon: Ellipsis },
] as const;

type AppNavProps = {
  displayName: string;
};

export function AppNav({ displayName }: AppNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Link href="/home" className="flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Trophy className="size-5 text-primary-foreground" aria-hidden />
          </span>
          <span className="font-heading text-lg tracking-wide">{APP_NAME}</span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1" aria-label={t("primary")}>
          {NAV_ITEMS.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-2">
          <Link
            href="/more"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 truncate">{displayName}</span>
          </Link>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={t("primary")}
      >
        <div className="grid h-16 grid-cols-5">
          {NAV_ITEMS.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive(href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive(href) && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                  aria-hidden
                />
              )}
              <Icon className="size-5" aria-hidden />
              {t(key)}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
