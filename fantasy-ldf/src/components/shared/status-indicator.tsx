"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MarketPlayer } from "@/lib/game/queries";

type Status = MarketPlayer["status"];

/**
 * Colour + glyph per unavailable status. `available` is absent on purpose:
 * a fit player gets no badge at all, so the marker only ever means "there's a
 * problem here" and doesn't become wallpaper.
 */
const FLAGS: Record<Exclude<Status, "available">, { tone: string; mark: string }> =
  {
    injured: { tone: "bg-red-500 text-white", mark: "+" },
    suspended: { tone: "bg-yellow-400 text-yellow-950", mark: "!" },
    unavailable: { tone: "bg-slate-400 text-slate-900", mark: "?" },
  };

/**
 * Small corner badge flagging an injured, suspended or otherwise unavailable
 * player. Renders nothing when the player is fit.
 */
export function StatusIndicator({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const t = useTranslations("team.status");
  if (status === "available") return null;

  const { tone, mark } = FLAGS[status];
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full text-[10px] font-bold leading-none shadow",
        tone,
        className
      )}
      title={t(status)}
      aria-label={t(status)}
    >
      {mark}
    </span>
  );
}
