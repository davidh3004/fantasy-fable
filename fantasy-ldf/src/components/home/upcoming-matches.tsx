import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { ClubCrest } from "@/components/shared/club-badge";
import { formatKickoff } from "@/lib/game/format";
import { groupByDay } from "@/lib/game/dashboard";
import { effectiveFixtureStatus } from "@/lib/game/status";
import { elapsedMinute } from "@/lib/game/match-clock";
import type { FixtureWithClubs } from "@/lib/game/queries";

type UpcomingMatchesProps = {
  fixtures: FixtureWithClubs[];
  /** clubId → how many of your squad play for them, for the "N of yours" note. */
  squadByClub: Record<string, number>;
  /** Cap so the card stays a summary; the full list lives at /matches. */
  limit?: number;
};

export async function UpcomingMatches({
  fixtures,
  squadByClub,
  limit = 5,
}: UpcomingMatchesProps) {
  const [t, locale] = await Promise.all([
    getTranslations("home"),
    getLocale(),
  ]);

  const now = new Date();
  // Grouped before slicing so the cap never strands a day header with no
  // fixtures under it.
  const days = groupByDay(fixtures.slice(0, limit), now);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          {t("matches.title")}
        </h2>
        <Link
          href="/matches"
          className="shrink-0 text-xs text-primary transition-colors hover:underline"
        >
          {t("matches.viewAll")}
        </Link>
      </div>

      {days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("fixtures.empty")}
        </p>
      ) : (
        days.map(({ offset, fixtures: dayFixtures }) => (
          <div key={offset} className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {offset === 0
                ? t("matches.today")
                : offset === 1
                  ? t("matches.tomorrow")
                  : formatKickoff(dayFixtures[0].kickoff, locale).split(",")[0]}
            </p>
            {dayFixtures.map((fixture) => (
              <MatchRow
                key={fixture.id}
                fixture={fixture}
                locale={locale}
                now={now}
                yours={
                  (squadByClub[fixture.homeClubId] ?? 0) +
                  (squadByClub[fixture.awayClubId] ?? 0)
                }
                yoursLabel={t("matches.yourPlayers", {
                  count:
                    (squadByClub[fixture.homeClubId] ?? 0) +
                    (squadByClub[fixture.awayClubId] ?? 0),
                })}
              />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

function MatchRow({
  fixture,
  locale,
  now,
  yours,
  yoursLabel,
}: {
  fixture: FixtureWithClubs;
  locale: string;
  now: Date;
  yours: number;
  yoursLabel: string;
}) {
  const status = effectiveFixtureStatus(fixture, now);
  const isLive = status === "live";
  const hasScore = fixture.homeScore != null && fixture.awayScore != null;

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="flex flex-col gap-1 rounded-lg border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/50"
    >
      <div className="flex items-center gap-2">
        <ClubCrest
          shortName={fixture.homeShort}
          name={fixture.homeName}
          color={fixture.homeColor}
          badgeUrl={fixture.homeBadgeUrl}
          className="size-6 text-[8px]"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {fixture.homeShort}
        </span>

        {/* Centre: score once there is one, otherwise the kickoff time. */}
        <span className="flex shrink-0 flex-col items-center">
          {isLive && (
            <span className="rounded bg-red-500/15 px-1 text-[9px] font-semibold uppercase leading-tight tracking-wide text-red-400">
              {elapsedMinute(fixture.kickoff, now)}&apos;
            </span>
          )}
          <span className="text-sm font-semibold tabular-nums">
            {hasScore
              ? `${fixture.homeScore} - ${fixture.awayScore}`
              : formatKickoff(fixture.kickoff, locale).split(", ").pop()}
          </span>
        </span>

        <span className="min-w-0 flex-1 truncate text-right text-xs font-medium">
          {fixture.awayShort}
        </span>
        <ClubCrest
          shortName={fixture.awayShort}
          name={fixture.awayName}
          color={fixture.awayColor}
          badgeUrl={fixture.awayBadgeUrl}
          className="size-6 text-[8px]"
        />
      </div>
      {yours > 0 && (
        <p className="text-[10px] text-muted-foreground">{yoursLabel}</p>
      )}
    </Link>
  );
}
