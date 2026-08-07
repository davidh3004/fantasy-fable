import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlarmClock,
  ArrowLeftRight,
  BadgeAlert,
  CircleUser,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusChipsProps = {
  /** Short form of the time left, e.g. "6d 12h". Null when no deadline. */
  deadlineShort: string | null;
  unavailableCount: number;
  freeTransfers: number;
  captainMissing: boolean;
};

type Chip = {
  key: string;
  Icon: LucideIcon;
  href: string;
  title: string;
  sub: string;
  tone: string;
};

/**
 * The "what needs your attention" strip.
 *
 * Each chip appears only when it has something to say — a squad with no
 * injuries doesn't get an injuries chip — so the row never pads itself with
 * reassurance nobody needs to read.
 */
export async function StatusChips({
  deadlineShort,
  unavailableCount,
  freeTransfers,
  captainMissing,
}: StatusChipsProps) {
  const t = await getTranslations("home.chips");

  const chips: Chip[] = [];

  if (deadlineShort) {
    chips.push({
      key: "deadline",
      Icon: AlarmClock,
      href: "/team",
      title: t("deadline", { time: deadlineShort }),
      sub: t("deadlineSub"),
      tone: "bg-amber-400/15 text-amber-300",
    });
  }
  if (unavailableCount > 0) {
    chips.push({
      key: "injured",
      Icon: BadgeAlert,
      href: "/team",
      title: t("injured", { count: unavailableCount }),
      sub: t("injuredSub"),
      tone: "bg-red-400/15 text-red-300",
    });
  }
  if (freeTransfers > 0) {
    chips.push({
      key: "transfers",
      Icon: ArrowLeftRight,
      href: "/transfers",
      title: t("freeTransfers", { count: freeTransfers }),
      sub: t("freeTransfersSub"),
      tone: "bg-cyan-400/15 text-cyan-300",
    });
  }
  if (captainMissing) {
    chips.push({
      key: "captain",
      Icon: CircleUser,
      href: "/team",
      title: t("captainNotPlayed"),
      sub: t("captainNotPlayedSub"),
      tone: "bg-emerald-400/15 text-emerald-300",
    });
  }

  if (chips.length === 0) return null;

  return (
    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {chips.map(({ key, Icon, href, title, sub, tone }) => (
        <Link
          key={key}
          href={href}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/50"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              tone
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">
              {title}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {sub}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
