import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fantasyTeams,
  gameweeks,
  miniLeagueMembers,
  miniLeagues,
  profiles,
} from "@/db/schema";

export type StandingRow = {
  rank: number;
  fantasyTeamId: string;
  teamName: string;
  managerName: string;
  gwPoints: number | null;
  totalPoints: number;
  isMe: boolean;
};

/** Latest finished gameweek id for a season (for the per-row GW points column). */
async function getLatestFinishedGameweekId(
  seasonId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: gameweeks.id })
    .from(gameweeks)
    .where(
      and(eq(gameweeks.seasonId, seasonId), eq(gameweeks.status, "finished"))
    )
    .orderBy(desc(gameweeks.number))
    .limit(1);
  return row?.id ?? null;
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
  const latestGwId = await getLatestFinishedGameweekId(seasonId);

  const gwPoints = latestGwId
    ? sql<number | null>`(
        select gl.points from gameweek_lineups gl
        where gl.fantasy_team_id = ${fantasyTeams.id}
          and gl.gameweek_id = ${latestGwId}
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

  return rows.map((r) => ({
    ...r,
    isMe: r.fantasyTeamId === myTeamId,
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
