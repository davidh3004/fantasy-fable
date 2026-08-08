import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, CalendarClock } from "lucide-react";
import { DeadlineCountdown } from "@/components/home/deadline-countdown";
import { cn } from "@/lib/utils";

type GameweekHeroProps = {
  teamName: string;
  gameweekNumber: number | null;
  /** "live" while matches are on, "finished" once finalized. */
  state: "live" | "finished" | "upcoming" | null;
  points: number | null;
  rank: number | null;
  managers: number | null;
  /** Places gained since the last finalize; null hides the arrow. */
  movement: number | null;
  played: { played: number; total: number } | null;
  deadline: Date | null;
  deadlineLabel: string | null;
};

export async function GameweekHero({
  teamName,
  gameweekNumber,
  state,
  points,
  rank,
  managers,
  movement,
  played,
  deadline,
  deadlineLabel,
}: GameweekHeroProps) {
  const t = await getTranslations("home");
  const tTeam = await getTranslations("team");

  const progress =
    played && played.total > 0 ? (played.played / played.total) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Identity + progress */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {gameweekNumber != null && (
              <span className="text-sm text-muted-foreground">
                {tTeam("gameweek", { number: gameweekNumber })}
              </span>
            )}
            {state && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  state === "live"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {state === "live"
                  ? tTeam("live")
                  : state === "finished"
                    ? tTeam("finished")
                    : tTeam("upcoming")}
              </span>
            )}
          </div>
          <h1 className="mt-0.5 truncate font-heading text-3xl">{teamName}</h1>

          {played && (
            <div className="mt-4 max-w-sm">
              <p className="text-xs text-muted-foreground">
                {t("hero.playersPlayed", {
                  played: played.played,
                  total: played.total,
                })}
              </p>
              {/* Plain div rather than the Progress primitive: this is a
                  static server render with no interactive semantics. */}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-cta transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Figures — points and rank read as a pair, split down the middle */}
        <div className="flex w-full flex-col gap-4 lg:w-auto lg:shrink-0">
          {/* Both halves share one structure — big value, then label, then an
              optional sub-line — and each centres inside its own half, so the
              pair reads as a symmetric split rather than two left-aligned
              blocks pushed against the divider. */}
          <dl className="flex items-stretch">
            <div className="flex min-w-0 flex-1 flex-col items-center px-2 text-center sm:px-4">
              <dd className="flex items-baseline gap-1.5">
                <span className="font-heading text-4xl leading-none tabular-nums">
                  {points ?? "—"}
                </span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {tTeam("ptsLabel")}
                </span>
              </dd>
              <dt className="mt-1.5 text-xs text-muted-foreground">
                {t("hero.thisGameweek")}
              </dt>
            </div>

            {/* self-stretch keeps the rule the height of the taller column
                instead of a fixed guess. */}
            <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

            <div className="flex min-w-0 flex-1 flex-col items-center px-2 text-center sm:px-4">
              <dd className="flex items-baseline gap-1.5">
                <span className="font-heading text-4xl leading-none tabular-nums">
                  {rank != null ? `#${rank}` : "—"}
                </span>
                <MovementArrow movement={movement} />
              </dd>
              <dt className="mt-1.5 text-xs text-muted-foreground">
                {t("hero.overallRank")}
              </dt>
              {rank != null && managers != null && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("hero.ofManagers", { managers })}
                </p>
              )}
            </div>
          </dl>

          {deadline && deadlineLabel && (
            <div className="flex flex-col items-center gap-2.5 border-t border-border pt-4 text-center">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden />
                {t("deadline.subtitle")}
              </p>
              <DeadlineCountdown deadline={deadline.toISOString()} />
              <p className="text-xs capitalize text-muted-foreground">
                {deadlineLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Places gained (up, green) or lost (down, red) in the last gameweek. */
export function MovementArrow({
  movement,
  className,
}: {
  movement: number | null;
  className?: string;
}) {
  if (movement == null || movement === 0) return null;
  const up = movement > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        up ? "text-emerald-400" : "text-red-400",
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(movement)}
    </span>
  );
}
