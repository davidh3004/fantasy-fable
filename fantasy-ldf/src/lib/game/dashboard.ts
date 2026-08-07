/**
 * Pure derivations behind the home dashboard.
 *
 * Kept out of the components so the arithmetic the page leans on — how many of
 * your XI have played, where you sit against the league, which fixture day a
 * kickoff belongs to — is testable without a database or a renderer.
 */

import { leagueDayOffset } from "./format";
import type { MarketPlayer } from "./queries";
import type { StandingRow } from "./leagues";

export type LineupPickLike = {
  playerId: string;
  slot: number;
  isCaptain: boolean;
};

export type PlayerStat = { points: number; minutes: number };

/**
 * How many of the starting XI have taken the pitch.
 *
 * Bench players are excluded deliberately: the figure answers "how much of my
 * gameweek has happened", and a bench player only counts once auto-subs bring
 * them on, at which point they occupy a starting slot in the resolved lineup.
 */
export function playersPlayed(
  picks: LineupPickLike[],
  stats: Map<string, PlayerStat>,
  startingSize: number
): { played: number; total: number } {
  const starters = picks.filter((p) => p.slot <= startingSize);
  const played = starters.filter(
    (p) => (stats.get(p.playerId)?.minutes ?? 0) > 0
  ).length;
  return { played, total: starters.length || startingSize };
}

/**
 * The captain, when they haven't played a minute. Null when they have, when
 * there's no captain, or when nothing has kicked off yet — the caller only
 * asks once the gameweek is under way, since before that it's not news.
 */
export function captainNotPlayed(
  picks: LineupPickLike[],
  stats: Map<string, PlayerStat>
): string | null {
  const captain = picks.find((p) => p.isCaptain);
  if (!captain) return null;
  return (stats.get(captain.playerId)?.minutes ?? 0) > 0
    ? null
    : captain.playerId;
}

/** Squad members who can't be picked — injured, suspended or otherwise out. */
export function unavailablePlayers(squad: MarketPlayer[]): MarketPlayer[] {
  return squad.filter((p) => p.status !== "available");
}

/**
 * Mean gameweek score across the league.
 *
 * Teams with no score yet are skipped rather than counted as zero, which would
 * drag the average down to meaninglessness early in a gameweek. Null when
 * nobody has scored — there's no average to state.
 */
export function leagueAverage(rows: StandingRow[]): number | null {
  const scored = rows.filter((r) => r.gwPoints != null);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, r) => sum + (r.gwPoints ?? 0), 0);
  return Math.round(total / scored.length);
}

/** Your highest scorer of the gameweek, with captaincy doubling applied. */
export function topScorer(
  squad: MarketPlayer[],
  picks: LineupPickLike[],
  stats: Map<string, PlayerStat>
): { player: MarketPlayer; points: number; isCaptain: boolean } | null {
  const captainId = picks.find((p) => p.isCaptain)?.playerId;
  let best: { player: MarketPlayer; points: number; isCaptain: boolean } | null =
    null;

  for (const player of squad) {
    const stat = stats.get(player.id);
    if (!stat || stat.minutes === 0) continue;
    const isCaptain = player.id === captainId;
    const points = isCaptain ? stat.points * 2 : stat.points;
    if (!best || points > best.points) best = { player, points, isCaptain };
  }
  return best;
}

export type FixtureDay<T> = { offset: number; fixtures: T[] };

/**
 * Groups fixtures into league-local calendar days, earliest first.
 *
 * The offset is what the caller turns into "Today" / "Tomorrow" / a date —
 * this function stays free of translation so it can be tested directly.
 */
export function groupByDay<T extends { kickoff: Date }>(
  fixtures: T[],
  now: Date = new Date()
): FixtureDay<T>[] {
  const days = new Map<number, T[]>();
  for (const fixture of fixtures) {
    const offset = leagueDayOffset(fixture.kickoff, now);
    const bucket = days.get(offset);
    if (bucket) bucket.push(fixture);
    else days.set(offset, [fixture]);
  }
  return [...days.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offset, list]) => ({
      offset,
      fixtures: [...list].sort(
        (a, b) => a.kickoff.getTime() - b.kickoff.getTime()
      ),
    }));
}
