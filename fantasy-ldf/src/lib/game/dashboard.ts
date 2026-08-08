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

export type PlayerStat = { points: number; minutes: number };

/**
 * The parts of the engine's ResolvedLineup the dashboard reads.
 *
 * Deriving from the resolved lineup rather than the raw squad is what keeps
 * these figures honest: it accounts for auto-subs and the captain/vice
 * fallback exactly as the points total does, and a team with no lineup for the
 * gameweek resolves to nothing at all.
 */
export type ResolvedLike = {
  finalStarterIds: Set<string>;
  pickPoints: Map<string, number>;
  multiplierPlayerId: string | null;
};

/**
 * How many of the counting XI have taken the pitch.
 *
 * Counts the players who actually score for you — after auto-subs — not the
 * originally-named eleven, so a benched replacement coming on moves the number.
 */
export function playersPlayed(
  resolved: ResolvedLike | null,
  stats: Map<string, PlayerStat>,
  startingSize: number
): { played: number; total: number } | null {
  if (!resolved || resolved.finalStarterIds.size === 0) return null;
  let played = 0;
  for (const id of resolved.finalStarterIds) {
    if ((stats.get(id)?.minutes ?? 0) > 0) played++;
  }
  return { played, total: startingSize };
}

/**
 * The chosen captain, when they haven't played a minute.
 *
 * Deliberately the *named* captain rather than whoever ended up with the
 * multiplier — the point of the warning is that your pick didn't turn up.
 */
export function captainNotPlayed(
  picks: Array<{ playerId: string; isCaptain: boolean }>,
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

/**
 * Your highest scorer of the gameweek.
 *
 * Only players whose points actually counted are eligible, using the effective
 * contribution the engine computed (captain multiplier already applied), so
 * this can never credit you for a player you didn't field.
 */
export function topScorer(
  resolved: ResolvedLike | null,
  playersById: Map<string, MarketPlayer>
): { player: MarketPlayer; points: number; isCaptain: boolean } | null {
  if (!resolved) return null;

  let best: { player: MarketPlayer; points: number; isCaptain: boolean } | null =
    null;
  for (const id of resolved.finalStarterIds) {
    const player = playersById.get(id);
    if (!player) continue;
    const points = resolved.pickPoints.get(id) ?? 0;
    if (!best || points > best.points) {
      best = { player, points, isCaptain: id === resolved.multiplierPlayerId };
    }
  }
  // Nobody has scored yet — "top scorer: 0 pts" is noise, not information.
  return best && best.points > 0 ? best : null;
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
