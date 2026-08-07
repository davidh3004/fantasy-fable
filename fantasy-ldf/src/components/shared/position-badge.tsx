"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Position } from "@/lib/game/squad";

/** One colour per line, so a squad list is scannable by position at a glance. */
export const POSITION_BADGE: Record<Position, string> = {
  GK: "bg-yellow-400/15 text-yellow-300",
  DEF: "bg-cyan-400/15 text-cyan-300",
  MID: "bg-emerald-400/15 text-emerald-300",
  FWD: "bg-rose-400/15 text-rose-300",
};

/**
 * Abbreviated position chip (POR/DEF/MED/DEL).
 *
 * Fixed width so prices stay aligned down a list of players — the labels are
 * different lengths across locales.
 */
export function PositionBadge({
  position,
  className,
}: {
  position: Position;
  className?: string;
}) {
  const tPos = useTranslations("positionsShort");

  return (
    <span
      className={cn(
        "w-11 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold",
        POSITION_BADGE[position],
        className
      )}
    >
      {tPos(position)}
    </span>
  );
}
