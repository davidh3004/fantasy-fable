"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/actions/locale";
import { LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Language names in their own language — never translated. */
const LABELS: Record<string, string> = {
  es: "Español",
  en: "English",
};

/**
 * Two-up language toggle. Kept as a segmented control rather than a dropdown:
 * with exactly two options both stay visible, so switching is one tap.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const active = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        isPending && "opacity-60",
        className
      )}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === active}
          disabled={isPending}
          onClick={() => startTransition(() => setLocale(locale))}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:cursor-wait",
            locale === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
