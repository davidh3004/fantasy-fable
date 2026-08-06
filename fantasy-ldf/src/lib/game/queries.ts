import { and, asc, desc, eq, gt, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  clubs,
  fantasyTeams,
  fixtures,
  gameSettings,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  players,
  profiles,
  seasons,
  squadPicks,
} from "@/db/schema";
import type { SquadSettings } from "./squad";
import type { StatLine } from "./scoring";

type SeasonContext = {
  season: typeof seasons.$inferSelect;
  settings: typeof gameSettings.$inferSelect;
};

// The active season + settings change rarely (admin action); a short
// in-process TTL removes one DB round-trip from almost every page render.
let seasonContextCache: { value: SeasonContext; expires: number } | null =
  null;
const SEASON_CONTEXT_TTL_MS = 60_000;

export async function getActiveSeasonContext(): Promise<SeasonContext> {
  if (seasonContextCache && Date.now() < seasonContextCache.expires) {
    return seasonContextCache.value;
  }

  // Single round-trip: season + its settings joined.
  const [row] = await db
    .select({ season: seasons, settings: gameSettings })
    .from(seasons)
    .innerJoin(gameSettings, eq(gameSettings.seasonId, seasons.id))
    .where(eq(seasons.isActive, true))
    .limit(1);

  if (!row) {
    throw new Error("No active season with game settings configured");
  }

  seasonContextCache = {
    value: row,
    expires: Date.now() + SEASON_CONTEXT_TTL_MS,
  };
  return row;
}

export function toSquadSettings(
  settings: typeof gameSettings.$inferSelect
): SquadSettings {
  return {
    budget: settings.budget,
    squadSize: settings.squadSize,
    gkCount: settings.gkCount,
    defCount: settings.defCount,
    midCount: settings.midCount,
    fwdCount: settings.fwdCount,
    maxPerClub: settings.maxPerClub,
    startingSize: settings.startingSize,
    minDef: settings.minDef,
    minMid: settings.minMid,
    minFwd: settings.minFwd,
  };
}

export async function getClubsByCompetition(competitionId: string) {
  return db
    .select()
    .from(clubs)
    .where(eq(clubs.competitionId, competitionId))
    .orderBy(asc(clubs.name));
}

export type MarketPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  price: number;
  status: "available" | "injured" | "suspended" | "unavailable";
  clubId: string;
  clubShortName: string;
  clubName: string;
  clubColor: string | null;
  clubBadgeUrl: string | null;
  photoUrl: string | null;
};

export async function getMarketPlayers(
  competitionId: string
): Promise<MarketPlayer[]> {
  return db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      price: players.price,
      status: players.status,
      clubId: players.clubId,
      clubShortName: clubs.shortName,
      clubName: clubs.name,
      clubColor: clubs.primaryColor,
      clubBadgeUrl: clubs.badgeUrl,
      photoUrl: players.photoUrl,
    })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(clubs.competitionId, competitionId))
    .orderBy(desc(players.price));
}

export type AdminPlayerFilters = {
  competitionId: string;
  clubId?: string;
  position?: "GK" | "DEF" | "MID" | "FWD";
  search?: string;
  limit: number;
  offset: number;
};

/**
 * One page of players for the admin list, filtered server-side so we never
 * ship the whole roster to the client. Returns the page rows + the total
 * count for the current filters (for pagination).
 */
export async function getAdminPlayers(
  opts: AdminPlayerFilters
): Promise<{ rows: MarketPlayer[]; total: number }> {
  const conds = [eq(clubs.competitionId, opts.competitionId)];
  if (opts.clubId) conds.push(eq(players.clubId, opts.clubId));
  if (opts.position) conds.push(eq(players.position, opts.position));
  const search = opts.search?.trim();
  if (search) {
    const like = `%${search}%`;
    conds.push(
      or(
        ilike(players.firstName, like),
        ilike(players.lastName, like),
        ilike(clubs.name, like)
      )!
    );
  }
  const where = and(...conds);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        price: players.price,
        status: players.status,
        clubId: players.clubId,
        clubShortName: clubs.shortName,
        clubName: clubs.name,
        clubColor: clubs.primaryColor,
        clubBadgeUrl: clubs.badgeUrl,
        photoUrl: players.photoUrl,
      })
      .from(players)
      .innerJoin(clubs, eq(players.clubId, clubs.id))
      .where(where)
      .orderBy(asc(players.lastName), asc(players.firstName))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(players)
      .innerJoin(clubs, eq(players.clubId, clubs.id))
      .where(where),
  ]);

  return { rows, total: totalRows[0]?.total ?? 0 };
}

export async function getUserFantasyTeam(userId: string, seasonId: string) {
  const [team] = await db
    .select()
    .from(fantasyTeams)
    .where(
      and(eq(fantasyTeams.userId, userId), eq(fantasyTeams.seasonId, seasonId))
    )
    .limit(1);
  return team ?? null;
}

export type FixtureWithClubs = {
  id: string;
  kickoff: Date;
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
  homeClubId: string;
  homeName: string;
  homeShort: string;
  homeColor: string | null;
  homeBadgeUrl: string | null;
  awayClubId: string;
  awayName: string;
  awayShort: string;
  awayColor: string | null;
  awayBadgeUrl: string | null;
};

export async function getFixturesForGameweek(
  gameweekId: string
): Promise<FixtureWithClubs[]> {
  const homeClub = alias(clubs, "home_club");
  const awayClub = alias(clubs, "away_club");

  return db
    .select({
      id: fixtures.id,
      kickoff: fixtures.kickoff,
      status: fixtures.status,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeClubId: fixtures.homeClubId,
      homeName: homeClub.name,
      homeShort: homeClub.shortName,
      homeColor: homeClub.primaryColor,
      homeBadgeUrl: homeClub.badgeUrl,
      awayClubId: fixtures.awayClubId,
      awayName: awayClub.name,
      awayShort: awayClub.shortName,
      awayColor: awayClub.primaryColor,
      awayBadgeUrl: awayClub.badgeUrl,
    })
    .from(fixtures)
    .innerJoin(homeClub, eq(fixtures.homeClubId, homeClub.id))
    .innerJoin(awayClub, eq(fixtures.awayClubId, awayClub.id))
    .where(eq(fixtures.gameweekId, gameweekId))
    .orderBy(asc(fixtures.kickoff));
}

/** Fixtures of the next upcoming gameweek, one round-trip via subquery. */
export async function getFixturesForNextGameweek(
  seasonId: string
): Promise<FixtureWithClubs[]> {
  const nextGameweekId = db
    .select({ id: gameweeks.id })
    .from(gameweeks)
    .where(
      and(
        eq(gameweeks.seasonId, seasonId),
        eq(gameweeks.status, "upcoming"),
        gt(gameweeks.deadline, new Date())
      )
    )
    .orderBy(asc(gameweeks.number))
    .limit(1);

  const homeClub = alias(clubs, "home_club");
  const awayClub = alias(clubs, "away_club");

  return db
    .select({
      id: fixtures.id,
      kickoff: fixtures.kickoff,
      status: fixtures.status,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeClubId: fixtures.homeClubId,
      homeName: homeClub.name,
      homeShort: homeClub.shortName,
      homeColor: homeClub.primaryColor,
      homeBadgeUrl: homeClub.badgeUrl,
      awayClubId: fixtures.awayClubId,
      awayName: awayClub.name,
      awayShort: awayClub.shortName,
      awayColor: awayClub.primaryColor,
      awayBadgeUrl: awayClub.badgeUrl,
    })
    .from(fixtures)
    .innerJoin(homeClub, eq(fixtures.homeClubId, homeClub.id))
    .innerJoin(awayClub, eq(fixtures.awayClubId, awayClub.id))
    .where(inArray(fixtures.gameweekId, nextGameweekId))
    .orderBy(asc(fixtures.kickoff));
}

/** The 15 squad players of a fantasy team, with club info for the pitch. */
export async function getSquadPlayers(
  fantasyTeamId: string
): Promise<MarketPlayer[]> {
  return db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      price: players.price,
      status: players.status,
      clubId: players.clubId,
      clubShortName: clubs.shortName,
      clubName: clubs.name,
      clubColor: clubs.primaryColor,
      clubBadgeUrl: clubs.badgeUrl,
      photoUrl: players.photoUrl,
    })
    .from(squadPicks)
    .innerJoin(players, eq(squadPicks.playerId, players.id))
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(squadPicks.fantasyTeamId, fantasyTeamId));
}

export type LineupPickRow = {
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isVice: boolean;
  points: number | null;
};

/** Saved lineup picks for a team in one gameweek, ordered by slot. */
export async function getLineupPicks(
  fantasyTeamId: string,
  gameweekId: string
): Promise<LineupPickRow[]> {
  return db
    .select({
      playerId: lineupPicks.playerId,
      slot: lineupPicks.slot,
      isCaptain: lineupPicks.isCaptain,
      isVice: lineupPicks.isVice,
      points: lineupPicks.points,
    })
    .from(lineupPicks)
    .innerJoin(gameweekLineups, eq(lineupPicks.lineupId, gameweekLineups.id))
    .where(
      and(
        eq(gameweekLineups.fantasyTeamId, fantasyTeamId),
        eq(gameweekLineups.gameweekId, gameweekId)
      )
    )
    .orderBy(asc(lineupPicks.slot));
}

/** The saved lineup row for a team in one gameweek (points snapshot + hits). */
export async function getLineupSummary(
  fantasyTeamId: string,
  gameweekId: string
): Promise<{ points: number | null; transfersCost: number } | null> {
  const [row] = await db
    .select({
      points: gameweekLineups.points,
      transfersCost: gameweekLineups.transfersCost,
    })
    .from(gameweekLineups)
    .where(
      and(
        eq(gameweekLineups.fantasyTeamId, fantasyTeamId),
        eq(gameweekLineups.gameweekId, gameweekId)
      )
    )
    .limit(1);
  return row ?? null;
}

/** Most recent gameweek whose deadline has passed (live or finished). Null
 *  in pre-season. This is the only gameweek another manager's team may be
 *  revealed for — picks stay private until the deadline locks them. */
export async function getLatestStartedGameweek(seasonId: string) {
  const [gameweek] = await db
    .select()
    .from(gameweeks)
    .where(
      and(eq(gameweeks.seasonId, seasonId), lte(gameweeks.deadline, new Date()))
    )
    .orderBy(desc(gameweeks.number))
    .limit(1);
  return gameweek ?? null;
}

export type ManagerPick = MarketPlayer & {
  slot: number;
  isCaptain: boolean;
  isVice: boolean;
  points: number | null;
};

/** A team's lineup for a gameweek, with full player info (from the frozen
 *  lineup picks, not the current squad). Ordered by slot. */
export async function getManagerLineup(
  fantasyTeamId: string,
  gameweekId: string
): Promise<ManagerPick[]> {
  return db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      price: players.price,
      status: players.status,
      clubId: players.clubId,
      clubShortName: clubs.shortName,
      clubName: clubs.name,
      clubColor: clubs.primaryColor,
      clubBadgeUrl: clubs.badgeUrl,
      photoUrl: players.photoUrl,
      slot: lineupPicks.slot,
      isCaptain: lineupPicks.isCaptain,
      isVice: lineupPicks.isVice,
      points: lineupPicks.points,
    })
    .from(lineupPicks)
    .innerJoin(gameweekLineups, eq(lineupPicks.lineupId, gameweekLineups.id))
    .innerJoin(players, eq(players.id, lineupPicks.playerId))
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(
      and(
        eq(gameweekLineups.fantasyTeamId, fantasyTeamId),
        eq(gameweekLineups.gameweekId, gameweekId)
      )
    )
    .orderBy(asc(lineupPicks.slot));
}

/** Public team header info (any team in the season). */
export async function getFantasyTeamPublic(fantasyTeamId: string) {
  const [row] = await db
    .select({
      id: fantasyTeams.id,
      name: fantasyTeams.name,
      seasonId: fantasyTeams.seasonId,
      totalPoints: fantasyTeams.totalPoints,
      managerName: profiles.displayName,
    })
    .from(fantasyTeams)
    .innerJoin(profiles, eq(profiles.id, fantasyTeams.userId))
    .where(eq(fantasyTeams.id, fantasyTeamId))
    .limit(1);
  return row ?? null;
}

/** True once the first gameweek deadline has passed (pre-season is over). */
export async function hasSeasonStarted(seasonId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: gameweeks.id })
    .from(gameweeks)
    .where(
      and(
        eq(gameweeks.seasonId, seasonId),
        lte(gameweeks.deadline, new Date())
      )
    )
    .limit(1);
  return Boolean(row);
}

export type TeamGameweek = {
  id: string;
  number: number;
  status: "upcoming" | "locked" | "finished";
  deadline: Date;
};

/** Every gameweek in the season, ordered — for the matches browser. */
export async function getSeasonGameweeks(
  seasonId: string
): Promise<TeamGameweek[]> {
  return db
    .select({
      id: gameweeks.id,
      number: gameweeks.number,
      status: gameweeks.status,
      deadline: gameweeks.deadline,
    })
    .from(gameweeks)
    .where(eq(gameweeks.seasonId, seasonId))
    .orderBy(asc(gameweeks.number));
}

export type FixtureDetail = FixtureWithClubs & { gameweekNumber: number };

/** A single fixture with both clubs + its gameweek number. */
export async function getFixtureById(
  fixtureId: string
): Promise<FixtureDetail | null> {
  const homeClub = alias(clubs, "home_club");
  const awayClub = alias(clubs, "away_club");
  const [row] = await db
    .select({
      id: fixtures.id,
      kickoff: fixtures.kickoff,
      status: fixtures.status,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeClubId: fixtures.homeClubId,
      homeName: homeClub.name,
      homeShort: homeClub.shortName,
      homeColor: homeClub.primaryColor,
      homeBadgeUrl: homeClub.badgeUrl,
      awayClubId: fixtures.awayClubId,
      awayName: awayClub.name,
      awayShort: awayClub.shortName,
      awayColor: awayClub.primaryColor,
      awayBadgeUrl: awayClub.badgeUrl,
      gameweekNumber: gameweeks.number,
    })
    .from(fixtures)
    .innerJoin(homeClub, eq(fixtures.homeClubId, homeClub.id))
    .innerJoin(awayClub, eq(fixtures.awayClubId, awayClub.id))
    .innerJoin(gameweeks, eq(fixtures.gameweekId, gameweeks.id))
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  return row ?? null;
}

export type FixtureStatRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  clubId: string;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  bonusPoints: number;
  points: number;
};

/** Per-player stat lines for a fixture, ordered by points desc. */
export async function getFixtureStats(
  fixtureId: string
): Promise<FixtureStatRow[]> {
  return db
    .select({
      playerId: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      clubId: players.clubId,
      minutes: playerMatchStats.minutes,
      goals: playerMatchStats.goals,
      assists: playerMatchStats.assists,
      cleanSheet: playerMatchStats.cleanSheet,
      saves: playerMatchStats.saves,
      penaltiesSaved: playerMatchStats.penaltiesSaved,
      penaltiesMissed: playerMatchStats.penaltiesMissed,
      goalsConceded: playerMatchStats.goalsConceded,
      yellowCards: playerMatchStats.yellowCards,
      redCards: playerMatchStats.redCards,
      ownGoals: playerMatchStats.ownGoals,
      bonusPoints: playerMatchStats.bonusPoints,
      points: playerMatchStats.points,
    })
    .from(playerMatchStats)
    .innerJoin(players, eq(players.id, playerMatchStats.playerId))
    .where(eq(playerMatchStats.fixtureId, fixtureId))
    .orderBy(desc(playerMatchStats.points));
}

/** Raw per-player points (no captain multiplier) from a gameweek's match
 *  stats — used for live points while a gameweek is in play. */
export async function getGameweekPlayerPoints(
  gameweekId: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      playerId: playerMatchStats.playerId,
      points: sql<number>`sum(${playerMatchStats.points})::int`,
    })
    .from(playerMatchStats)
    .innerJoin(fixtures, eq(playerMatchStats.fixtureId, fixtures.id))
    .where(eq(fixtures.gameweekId, gameweekId))
    .groupBy(playerMatchStats.playerId);
  return new Map(rows.map((r) => [r.playerId, r.points]));
}

/** Raw per-player points + minutes for a gameweek — drives auto-sub display. */
export async function getGameweekPlayerStats(
  gameweekId: string
): Promise<Map<string, { points: number; minutes: number }>> {
  const rows = await db
    .select({
      playerId: playerMatchStats.playerId,
      points: sql<number>`sum(${playerMatchStats.points})::int`,
      minutes: sql<number>`sum(${playerMatchStats.minutes})::int`,
    })
    .from(playerMatchStats)
    .innerJoin(fixtures, eq(playerMatchStats.fixtureId, fixtures.id))
    .where(eq(fixtures.gameweekId, gameweekId))
    .groupBy(playerMatchStats.playerId);
  return new Map(
    rows.map((r) => [r.playerId, { points: r.points, minutes: r.minutes }])
  );
}

/**
 * Full stat lines for a gameweek, summed across fixtures so double gameweeks
 * add up. Feeds the player modal's points breakdown — `getGameweekPlayerStats`
 * only carries the total, which can't explain *how* it was earned.
 */
export async function getGameweekStatLines(
  gameweekId: string
): Promise<Map<string, StatLine>> {
  const rows = await db
    .select({
      playerId: playerMatchStats.playerId,
      minutes: sql<number>`sum(${playerMatchStats.minutes})::int`,
      goals: sql<number>`sum(${playerMatchStats.goals})::int`,
      assists: sql<number>`sum(${playerMatchStats.assists})::int`,
      saves: sql<number>`sum(${playerMatchStats.saves})::int`,
      penaltiesSaved: sql<number>`sum(${playerMatchStats.penaltiesSaved})::int`,
      penaltiesMissed: sql<number>`sum(${playerMatchStats.penaltiesMissed})::int`,
      goalsConceded: sql<number>`sum(${playerMatchStats.goalsConceded})::int`,
      yellowCards: sql<number>`sum(${playerMatchStats.yellowCards})::int`,
      redCards: sql<number>`sum(${playerMatchStats.redCards})::int`,
      ownGoals: sql<number>`sum(${playerMatchStats.ownGoals})::int`,
      bonusPoints: sql<number>`sum(${playerMatchStats.bonusPoints})::int`,
      // Any clean sheet across the gameweek's fixtures counts.
      cleanSheet: sql<boolean>`bool_or(${playerMatchStats.cleanSheet})`,
    })
    .from(playerMatchStats)
    .innerJoin(fixtures, eq(playerMatchStats.fixtureId, fixtures.id))
    .where(eq(fixtures.gameweekId, gameweekId))
    .groupBy(playerMatchStats.playerId);

  return new Map(rows.map((r) => [r.playerId, r]));
}

export type GameweekStatLines = {
  gameweekId: string;
  number: number;
  lines: Record<string, StatLine>;
};

/**
 * Stat lines for every started gameweek of a season, keyed by gameweek then
 * player. Powers the player modal's gameweek stepper, so a player's record can
 * be walked jornada by jornada without a round trip per step.
 *
 * Bounded by squad size × gameweeks played, which stays small.
 */
export async function getSeasonStatLinesByGameweek(
  seasonId: string
): Promise<GameweekStatLines[]> {
  const rows = await db
    .select({
      gameweekId: gameweeks.id,
      number: gameweeks.number,
      playerId: playerMatchStats.playerId,
      minutes: sql<number>`sum(${playerMatchStats.minutes})::int`,
      goals: sql<number>`sum(${playerMatchStats.goals})::int`,
      assists: sql<number>`sum(${playerMatchStats.assists})::int`,
      saves: sql<number>`sum(${playerMatchStats.saves})::int`,
      penaltiesSaved: sql<number>`sum(${playerMatchStats.penaltiesSaved})::int`,
      penaltiesMissed: sql<number>`sum(${playerMatchStats.penaltiesMissed})::int`,
      goalsConceded: sql<number>`sum(${playerMatchStats.goalsConceded})::int`,
      yellowCards: sql<number>`sum(${playerMatchStats.yellowCards})::int`,
      redCards: sql<number>`sum(${playerMatchStats.redCards})::int`,
      ownGoals: sql<number>`sum(${playerMatchStats.ownGoals})::int`,
      bonusPoints: sql<number>`sum(${playerMatchStats.bonusPoints})::int`,
      cleanSheet: sql<boolean>`bool_or(${playerMatchStats.cleanSheet})`,
    })
    .from(playerMatchStats)
    .innerJoin(fixtures, eq(playerMatchStats.fixtureId, fixtures.id))
    .innerJoin(gameweeks, eq(fixtures.gameweekId, gameweeks.id))
    .where(eq(gameweeks.seasonId, seasonId))
    .groupBy(gameweeks.id, gameweeks.number, playerMatchStats.playerId)
    .orderBy(asc(gameweeks.number));

  const byGameweek = new Map<string, GameweekStatLines>();
  for (const { gameweekId, number, playerId, ...stats } of rows) {
    let entry = byGameweek.get(gameweekId);
    if (!entry) {
      entry = { gameweekId, number, lines: {} };
      byGameweek.set(gameweekId, entry);
    }
    entry.lines[playerId] = stats;
  }
  return [...byGameweek.values()].sort((a, b) => a.number - b.number);
}

/** Next gameweek whose deadline hasn't passed. Null between last GW and season end. */
export async function getNextGameweek(seasonId: string) {
  const [gameweek] = await db
    .select()
    .from(gameweeks)
    .where(
      and(
        eq(gameweeks.seasonId, seasonId),
        eq(gameweeks.status, "upcoming"),
        gt(gameweeks.deadline, new Date())
      )
    )
    .orderBy(asc(gameweeks.number))
    .limit(1);
  return gameweek ?? null;
}
