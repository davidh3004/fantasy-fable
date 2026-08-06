import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

type GameweekNavProps = {
  number: number;
  statusLabel: string;
  subLabel: string;
  /** Full hrefs so the nav can be reused outside /team (e.g. rival teams). */
  prevHref: string | null;
  nextHref: string | null;
  /** Matches in play — the status ribbon turns red. */
  isLive?: boolean;
};

function ArrowLink({
  href,
  direction,
  label,
}: {
  href: string | null;
  direction: "prev" | "next";
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const className = cn(
    "flex size-10 items-center justify-center rounded-lg border border-border transition-colors",
    href != null
      ? "cursor-pointer bg-card hover:border-primary/50 hover:text-foreground text-muted-foreground"
      : "pointer-events-none opacity-30"
  );
  if (href == null) {
    return (
      <span className={className} aria-disabled>
        <Icon className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}

export async function GameweekNav({
  number,
  statusLabel,
  subLabel,
  prevHref,
  nextHref,
  isLive = false,
}: GameweekNavProps) {
  const t = await getTranslations("team");

  return (
    <div className="flex items-center gap-2">
      <ArrowLink href={prevHref} direction="prev" label={t("prevGw")} />
      <div className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-medium">
          {t("gameweek", { number })}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              isLive
                ? "bg-destructive text-white"
                : "bg-muted font-medium text-muted-foreground"
            )}
          >
            {isLive && (
              <span
                className="mr-1 inline-block size-1.5 rounded-full bg-white align-middle"
                aria-hidden
              />
            )}
            {statusLabel}
          </span>
        </p>
        <p className="truncate text-xs capitalize text-muted-foreground">
          {subLabel}
        </p>
      </div>
      <ArrowLink href={nextHref} direction="next" label={t("nextGw")} />
    </div>
  );
}
