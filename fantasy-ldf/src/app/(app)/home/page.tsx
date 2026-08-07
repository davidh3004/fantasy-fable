import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { GameweekHero } from "@/components/home/gameweek-hero";
import { StatusChips } from "@/components/home/status-chips";
import { PerformanceCard } from "@/components/home/performance-card";
import { UpcomingMatches } from "@/components/home/upcoming-matches";
import { MiniStandings } from "@/components/home/mini-standings";
import { QuickActions } from "@/components/home/quick-actions";
import { formatDeadline } from "@/lib/game/format";
import {
  captainNotPlayed,
  leagueAverage,
  playersPlayed,
  topScorer,
  unavailablePlayers,
} from "@/lib/game/dashboard";
import {
  getActiveSeasonContext,
  getFixturesForGameweek,
  getGameweekPlayerStats,
  getLatestStartedGameweek,
  getLineupPicks,
  getNextGameweek,
  getSquadPlayers,
  getUserFantasyTeam,
  toSquadSettings,
} from "@/lib/game/queries";
import { getMyOverallStanding, getStandings } from "@/lib/game/leagues";
import { getTeamGameweekPoints } from "@/lib/game/gameweek-points";
import { effectiveGameweekStatus } from "@/lib/game/status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

/** Coarse "6d 12h" / "45m" form for the deadline chip. */
function shortCountdown(deadline: Date, now: Date): string | null {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Season context is TTL-cached; everything independent runs in one stage.
  const { season, settings } = await getActiveSeasonContext();
  const squadSettings = toSquadSettings(settings);

  const [team, nextGameweek, startedGameweek, locale] = await Promise.all([
    getUserFantasyTeam(user.id, season.id),
    getNextGameweek(season.id),
    getLatestStartedGameweek(season.id),
    getLocale(),
  ]);
  if (!team) redirect("/onboarding");

  const now = new Date();

  // The gameweek the page reports on: the one in play or last finalized when
  // there is one, otherwise the upcoming one we're waiting on.
  const displayGameweek = startedGameweek ?? nextGameweek;
  const gameweekState = displayGameweek
    ? effectiveGameweekStatus(displayGameweek, now) === "locked"
      ? ("live" as const)
      : effectiveGameweekStatus(displayGameweek, now) === "finished"
        ? ("finished" as const)
        : ("upcoming" as const)
    : null;

  // A high limit so the league average is over everyone, not the top page.
  const [standings, overall, squad, fixtures, picks, playerStats, points] =
    await Promise.all([
      getStandings({ seasonId: season.id, myTeamId: team.id, limit: 1000 }),
      getMyOverallStanding(season.id, team.id),
      getSquadPlayers(team.id),
      displayGameweek ? getFixturesForGameweek(displayGameweek.id) : [],
      startedGameweek ? getLineupPicks(team.id, startedGameweek.id) : [],
      startedGameweek
        ? getGameweekPlayerStats(startedGameweek.id)
        : new Map<string, { points: number; minutes: number }>(),
      startedGameweek
        ? getTeamGameweekPoints(team.id, startedGameweek, squadSettings)
        : null,
    ]);

  const played =
    startedGameweek && picks.length > 0
      ? playersPlayed(picks, playerStats, squadSettings.startingSize)
      : null;

  // Only worth flagging once matches are actually under way.
  const captainMissing =
    gameweekState === "live" && captainNotPlayed(picks, playerStats) != null;

  const squadByClub: Record<string, number> = {};
  for (const player of squad) {
    squadByClub[player.clubId] = (squadByClub[player.clubId] ?? 0) + 1;
  }

  const deadlineShort = nextGameweek
    ? shortCountdown(nextGameweek.deadline, now)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <GameweekHero
        teamName={team.name}
        gameweekNumber={displayGameweek?.number ?? null}
        state={gameweekState}
        points={points}
        rank={overall?.rank ?? null}
        managers={overall?.managers ?? null}
        movement={
          team.previousOverallRank != null && team.overallRank != null
            ? team.previousOverallRank - team.overallRank
            : null
        }
        played={played}
        deadline={nextGameweek?.deadline ?? null}
        deadlineLabel={
          nextGameweek ? formatDeadline(nextGameweek.deadline, locale) : null
        }
      />

      <StatusChips
        deadlineShort={deadlineShort}
        unavailableCount={unavailablePlayers(squad).length}
        freeTransfers={team.freeTransfers}
        captainMissing={captainMissing}
      />

      {/* Three cards side by side on desktop, stacked on a phone. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PerformanceCard
          points={points}
          leagueAverage={leagueAverage(standings)}
          played={played}
          topScorer={topScorer(squad, picks, playerStats)}
        />
        <UpcomingMatches fixtures={fixtures} squadByClub={squadByClub} />
        <MiniStandings rows={standings} myRank={overall?.rank ?? null} />
      </div>

      <QuickActions />
    </main>
  );
}
