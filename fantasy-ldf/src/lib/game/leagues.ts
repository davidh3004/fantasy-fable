import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fantasyTeams,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  miniLeagueMembers,
  miniLeagues,
  players,
  profiles,
} from "@/db/schema";
import { resolveLineup, type EnginePick } from "./engine";
import {
  getActiveSeasonContext,
  getGameweekPlayerStats,
  toSquadSettings,
} from "./queries";
import type { SquadSettings } from "./squad";

/** Squad settings for the season — needed to resolve auto-subs. */
async function getSeasonSquadSettings(
  seasonId: string
): Promise<SquadSettings> {
  const { season, settings } = await getActiveSeasonContext();
  // Standings are always rendered for the active season; guard anyway.
  if (season.id !== seasonId) throw new Error("standings: season mismatch");
  return toSquadSettings(settings);
}

export type StandingRow = {
  rank: number;
  fantasyTeamId: string;
  teamName: string;
  managerName: string;
  gwPoints: number | null;
  totalPoints: number;
  isMe: boolean;
  /**
   * Places gained since the last finalize (positive = moved up), or null when
   * there's no prior rank to compare against. Derived from the stored ranks,
   * not the live one, so it doesn't jitter mid-gameweek.
   */
  movement: number | null;
};

/**
 * The gameweek the GW column should report on: the one in play if there is
 * one, otherwise the most recently played. Deliberately not "latest finished"
 * — that showed a stale column all through a live gameweek.
 */
async function getColumnGameweek(seasonId: string) {
  const [row] = await db
    .select({
      id: gameweeks.id,
      status: gameweeks.status,
      deadline: gameweeks.deadline,
    })
    .from(gameweeks)
    .where(and(eq(gameweeks.seasonId, seasonId), lte(gameweeks.deadline, new Date())))
    .orderBy(desc(gameweeks.number))
    .limit(1);
  return row ?? null;
}

/**
 * Live gameweek points for many teams at once.
 *
 * The finalize engine is what writes `gameweek_lineups.points`, so mid-gameweek
 * there is nothing stored to read — it has to be recomputed. Done in two
 * queries for the whole table (picks, then match stats) and resolved in memory,
 * reusing the same `resolveLineup` the team page and finalize use so every
 * surface reports the same number.
 */
async function computeLiveGwPoints(
  gameweekId: string,
  teamIds: string[],
  settings: SquadSettings
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (teamIds.length === 0) return result;

  const [pickRows, stats] = await Promise.all([
    db
      .select({
        fantasyTeamId: gameweekLineups.fantasyTeamId,
        transfersCost: gameweekLineups.transfersCost,
        playerId: lineupPicks.playerId,
        slot: lineupPicks.slot,
        isCaptain: lineupPicks.isCaptain,
        isVice: lineupPicks.isVice,
        position: players.position,
      })
      .from(gameweekLineups)
      .innerJoin(lineupPicks, eq(lineupPicks.lineupId, gameweekLineups.id))
      .innerJoin(players, eq(players.id, lineupPicks.playerId))
      .where(
        and(
          eq(gameweekLineups.gameweekId, gameweekId),
          inArray(gameweekLineups.fantasyTeamId, teamIds)
        )
      ),
    getGameweekPlayerStats(gameweekId),
  ]);

  const byTeam = new Map<
    string,
    { transfersCost: number; picks: EnginePick[] }
  >();
  for (const row of pickRows) {
    let entry = byTeam.get(row.fantasyTeamId);
    if (!entry) {
      entry = { transfersCost: row.transfersCost, picks: [] };
      byTeam.set(row.fantasyTeamId, entry);
    }
    entry.picks.push({
      playerId: row.playerId,
      slot: row.slot,
      isCaptain: row.isCaptain,
      isVice: row.isVice,
      position: row.position,
      points: stats.get(row.playerId)?.points ?? 0,
      minutes: stats.get(row.playerId)?.minutes ?? 0,
    });
  }

  for (const [teamId, entry] of byTeam) {
    const resolved = resolveLineup(entry.picks, settings);
    result.set(teamId, resolved.total - entry.transfersCost);
  }
  return result;
}

type StandingsOpts = {
  seasonId: string;
  myTeamId: string;
  leagueId?: string; // omit for the global overall league
  limit?: number;
};

/** Ranked standings by total points (ties broken by earliest registration). */
export async function getStandings(
  opts: StandingsOpts
): Promise<StandingRow[]> {
  const { seasonId, myTeamId, leagueId, limit = 100 } = opts;
  const columnGameweek = await getColumnGameweek(seasonId);
  const isFinalized = columnGameweek?.status === "finished";

  // A finalized gameweek has a stored snapshot; a live one has to be computed
  // below, after we know which teams are on the page.
  const gwPoints =
    columnGameweek && isFinalized
      ? sql<number | null>`(
        select gl.points from gameweek_lineups gl
        where gl.fantasy_team_id = ${fantasyTeams.id}
          and gl.gameweek_id = ${columnGameweek.id}
      )`
      : sql<number | null>`null`;

  const rankExpr = sql<number>`rank() over (
    order by ${fantasyTeams.totalPoints} desc, ${fantasyTeams.createdAt} asc
  )`;

  const base = db
    .select({
      rank: rankExpr,
      fantasyTeamId: fantasyTeams.id,
      teamName: fantasyTeams.name,
      managerName: profiles.displayName,
      gwPoints,
      totalPoints: fantasyTeams.totalPoints,
      storedRank: fantasyTeams.overallRank,
      previousRank: fantasyTeams.previousOverallRank,
    })
    .from(fantasyTeams)
    .innerJoin(profiles, eq(profiles.id, fantasyTeams.userId))
    .$dynamic();

  const rows = leagueId
    ? await base
        .innerJoin(
          miniLeagueMembers,
          eq(miniLeagueMembers.fantasyTeamId, fantasyTeams.id)
        )
        .where(
          and(
            eq(fantasyTeams.seasonId, seasonId),
            eq(miniLeagueMembers.leagueId, leagueId)
          )
        )
        .orderBy(asc(rankExpr))
        .limit(limit)
    : await base
        .where(eq(fantasyTeams.seasonId, seasonId))
        .orderBy(asc(rankExpr))
        .limit(limit);

  // Gameweek in play: nothing is stored yet, so recompute for the whole page.
  const livePoints =
    columnGameweek && !isFinalized
      ? await computeLiveGwPoints(
          columnGameweek.id,
          rows.map((r) => r.fantasyTeamId),
          await getSeasonSquadSettings(seasonId)
        )
      : null;

  return rows.map(({ storedRank, previousRank, ...r }) => ({
    ...r,
    gwPoints: livePoints ? (livePoints.get(r.fantasyTeamId) ?? null) : r.gwPoints,
    isMe: r.fantasyTeamId === myTeamId,
    movement:
      previousRank != null && storedRank != null
        ? previousRank - storedRank
        : null,
  }));
}

/** The user's overall rank + total, even when outside the top page. */
export async function getMyOverallStanding(
  seasonId: string,
  myTeamId: string
): Promise<{ rank: number; total: number; managers: number } | null> {
  const [me] = await db
    .select({ total: fantasyTeams.totalPoints, createdAt: fantasyTeams.createdAt })
    .from(fantasyTeams)
    .where(eq(fantasyTeams.id, myTeamId))
    .limit(1);
  if (!me) return null;

  // ISO string + explicit cast: postgres.js can't bind a JS Date inside a
  // raw `filter (...)` expression.
  const meCreatedAt = me.createdAt.toISOString();
  const [agg] = await db
    .select({
      ahead: sql<number>`count(*) filter (
        where ${fantasyTeams.totalPoints} > ${me.total}
          or (${fantasyTeams.totalPoints} = ${me.total}
              and ${fantasyTeams.createdAt} < ${meCreatedAt}::timestamptz)
      )::int`,
      managers: sql<number>`count(*)::int`,
    })
    .from(fantasyTeams)
    .where(eq(fantasyTeams.seasonId, seasonId));

  return { rank: agg.ahead + 1, total: me.total, managers: agg.managers };
}

export type MyLeague = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  myRank: number;
  isOwner: boolean;
};

/** Private leagues the team belongs to, with member count + the user's rank. */
export async function getMyLeagues(
  myTeamId: string,
  userId: string
): Promise<MyLeague[]> {
  const leagues = await db
    .select({
      id: miniLeagues.id,
      name: miniLeagues.name,
      inviteCode: miniLeagues.inviteCode,
      ownerId: miniLeagues.ownerId,
      memberCount: sql<number>`(
        select count(*)::int from mini_league_members m
        where m.league_id = ${miniLeagues.id}
      )`,
      myRank: sql<number>`(
        select count(*)::int + 1 from mini_league_members m2
        join fantasy_teams ft2 on ft2.id = m2.fantasy_team_id
        join fantasy_teams me on me.id = ${myTeamId}
        where m2.league_id = ${miniLeagues.id}
          and (ft2.total_points > me.total_points
               or (ft2.total_points = me.total_points
                   and ft2.created_at < me.created_at))
      )`,
    })
    .from(miniLeagues)
    .innerJoin(
      miniLeagueMembers,
      eq(miniLeagueMembers.leagueId, miniLeagues.id)
    )
    .where(eq(miniLeagueMembers.fantasyTeamId, myTeamId))
    .orderBy(asc(miniLeagues.createdAt));

  return leagues.map((l) => ({
    id: l.id,
    name: l.name,
    inviteCode: l.inviteCode,
    memberCount: l.memberCount,
    myRank: l.myRank,
    isOwner: l.ownerId === userId,
  }));
}

export async function getLeagueForMember(
  leagueId: string,
  myTeamId: string
): Promise<{
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
} | null> {
  const [league] = await db
    .select({
      id: miniLeagues.id,
      name: miniLeagues.name,
      inviteCode: miniLeagues.inviteCode,
      ownerId: miniLeagues.ownerId,
    })
    .from(miniLeagues)
    .innerJoin(
      miniLeagueMembers,
      eq(miniLeagueMembers.leagueId, miniLeagues.id)
    )
    .where(
      and(
        eq(miniLeagues.id, leagueId),
        eq(miniLeagueMembers.fantasyTeamId, myTeamId)
      )
    )
    .limit(1);
  return league ?? null;
}
