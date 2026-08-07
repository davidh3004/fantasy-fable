import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { cn } from "@/lib/utils";
import type { MarketPlayer } from "@/lib/game/queries";

type PerformanceCardProps = {
  points: number | null;
  leagueAverage: number | null;
  played: { played: number; total: number } | null;
  topScorer: {
    player: MarketPlayer;
    points: number;
    isCaptain: boolean;
  } | null;
};

export async function PerformanceCard({
  points,
  leagueAverage,
  played,
  topScorer,
}: PerformanceCardProps) {
  const t = await getTranslations("home");
  const tTeam = await getTranslations("team");

  // Only meaningful when both halves exist — "above average" against no
  // average is a number pretending to be a comparison.
  const delta =
    points != null && leagueAverage != null ? points - leagueAverage : null;

  // `unit` is the small label under the figure — "pts" where the number is a
  // score, "players" where it's a count, so the row reads consistently.
  const figures = [
    {
      key: "points",
      value: points != null ? String(points) : "—",
      unit: tTeam("ptsLabel"),
    },
    {
      key: "leagueAvg",
      value: leagueAverage != null ? String(leagueAverage) : "—",
      unit: tTeam("ptsLabel"),
    },
    {
      key: "vsAvg",
      value: delta != null ? `${delta > 0 ? "+" : ""}${delta}` : "—",
      unit: tTeam("ptsLabel"),
      tone:
        delta == null
          ? undefined
          : delta > 0
            ? "text-emerald-400"
            : delta < 0
              ? "text-red-400"
              : undefined,
    },
    {
      key: "played",
      value: played ? `${played.played}/${played.total}` : "—",
      unit: t("performance.playedUnit"),
    },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-heading text-base">
        <TrendingUp className="size-4 text-primary" aria-hidden />
        {t("performance.title")}
      </h2>

      {/* Four equal columns, each centred in its own slot, separated by rules
          that run the full height of the row. */}
      <dl className="flex items-stretch">
        {figures.map(({ key, value, unit, tone }, index) => (
          <Fragment key={key}>
            {index > 0 && (
              <div
                className="w-px shrink-0 self-stretch bg-border"
                aria-hidden
              />
            )}
            <div className="flex flex-1 flex-col items-center px-1 text-center">
              <dd
                className={cn(
                  "font-heading text-xl leading-none tabular-nums",
                  tone
                )}
              >
                {value}
              </dd>
              <dd className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {unit}
              </dd>
              <dt className="mt-1 text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">
                {t(`performance.${key}`)}
              </dt>
            </div>
          </Fragment>
        ))}
      </dl>

      {topScorer && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
          <PlayerAvatar
            photoUrl={topScorer.player.photoUrl}
            className="size-9"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("performance.topScorer")}
            </span>
            <span className="block truncate text-sm font-medium">
              {topScorer.player.firstName} {topScorer.player.lastName}
            </span>
          </span>
          {topScorer.isCaptain && (
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-yellow-950"
              title={tTeam("captain")}
            >
              C
            </span>
          )}
          <span className="shrink-0 text-right">
            <span className="block font-heading text-lg leading-none tabular-nums">
              {topScorer.points}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              {tTeam("ptsLabel")}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}
