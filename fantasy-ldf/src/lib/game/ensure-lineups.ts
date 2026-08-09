import { and, asc, eq, inArray, lt, lte, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fantasyTeams,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  players,
  squadPicks,
} from "@/db/schema";
import { buildInitialLineup, type PickablePlayer } from "./squad";

/**
 * Freezes a lineup for every team that was already playing when this gameweek
 * locked, so nobody reads as "no team this gameweek" for having left the app
 * alone.
 *
 * A lineup row is only written when a manager touches a screen: onboarding
 * creates one for whatever gameweek was upcoming at signup, and saving a
 * lineup or making transfers writes the next one. A manager who is happy with
 * their side and never opens it again gets no row at all — so once the
 * deadline passes, their team page says they had no team, which is plainly
 * wrong for someone who has been playing since before gameweek 1.
 *
 * The deadline is the moment that matters, not finalization: a gameweek can
 * sit locked for days before an admin finalizes it, and the squad that was
 * standing when the deadline passed is the one that plays.
 *
 * Teams created *after* the deadline are deliberately left without a row. They
 * genuinely were not playing that gameweek, and "no team" is the honest thing
 * to show them — this is also what keeps a late joiner from being handed
 * points for a gameweek that ended before they signed up.
 *
 * Idempotent and safe to call from anywhere: it writes only what is missing,
 * and loses the race gracefully if a manager saves at the same moment.
 */
export async function ensureLineupsForGameweek(
  gameweekId: string,
  seasonId: string,
  startingSize: number
): Promise<number> {
  const [gameweek] = await db
    .select({ deadline: gameweeks.deadline })
    .from(gameweeks)
    .where(eq(gameweeks.id, gameweekId))
    .limit(1);
  if (!gameweek) return 0;

  const missing = await db
    .select({ id: fantasyTeams.id })
    .from(fantasyTeams)
    .where(
      and(
        eq(fantasyTeams.seasonId, seasonId),
        // Already playing when the deadline hit.
        lte(fantasyTeams.createdAt, gameweek.deadline),
        notExists(
          db
            .select({ one: sql`1` })
            .from(gameweekLineups)
            .where(
              and(
                eq(gameweekLineups.fantasyTeamId, fantasyTeams.id),
                eq(gameweekLineups.gameweekId, gameweekId)
              )
            )
        )
      )
    );
  if (missing.length === 0) return 0;

  const teamIds = missing.map((t) => t.id);

  // Current squads, with what buildInitialLineup needs to rank them.
  const squadRows = await db
    .select({
      fantasyTeamId: squadPicks.fantasyTeamId,
      id: players.id,
      position: players.position,
      price: players.price,
      clubId: players.clubId,
    })
    .from(squadPicks)
    .innerJoin(players, eq(players.id, squadPicks.playerId))
    .where(inArray(squadPicks.fantasyTeamId, teamIds));

  const squads = new Map<string, PickablePlayer[]>();
  for (const { fantasyTeamId, ...player } of squadRows) {
    const squad = squads.get(fantasyTeamId) ?? [];
    squad.push(player);
    squads.set(fantasyTeamId, squad);
  }

  // Each team's most recent lineup before this gameweek, to carry forward.
  const priorRows = await db
    .select({
      fantasyTeamId: gameweekLineups.fantasyTeamId,
      number: gameweeks.number,
      playerId: lineupPicks.playerId,
      slot: lineupPicks.slot,
      isCaptain: lineupPicks.isCaptain,
      isVice: lineupPicks.isVice,
    })
    .from(gameweekLineups)
    .innerJoin(gameweeks, eq(gameweeks.id, gameweekLineups.gameweekId))
    .innerJoin(lineupPicks, eq(lineupPicks.lineupId, gameweekLineups.id))
    .where(
      and(
        inArray(gameweekLineups.fantasyTeamId, teamIds),
        eq(gameweeks.seasonId, seasonId),
        lt(
          gameweeks.number,
          db
            .select({ n: gameweeks.number })
            .from(gameweeks)
            .where(eq(gameweeks.id, gameweekId))
        )
      )
    )
    .orderBy(asc(gameweeks.number), asc(lineupPicks.slot));

  type PriorPick = {
    playerId: string;
    slot: number;
    isCaptain: boolean;
    isVice: boolean;
  };
  // Ordered ascending, so the last gameweek seen per team wins.
  const latestPrior = new Map<string, { number: number; picks: PriorPick[] }>();
  for (const { fantasyTeamId, number, ...pick } of priorRows) {
    const entry = latestPrior.get(fantasyTeamId);
    if (!entry || entry.number < number) {
      latestPrior.set(fantasyTeamId, { number, picks: [pick] });
    } else if (entry.number === number) {
      entry.picks.push(pick);
    }
  }

  let created = 0;
  await db.transaction(async (tx) => {
    for (const teamId of teamIds) {
      const squad = squads.get(teamId);
      if (!squad || squad.length === 0) continue;

      const owned = new Set(squad.map((p) => p.id));
      const carried = latestPrior.get(teamId)?.picks ?? [];
      const usable = carried.filter((pick) => owned.has(pick.playerId));

      // A partial carry-forward can't be trusted to be a legal XI, so rebuild.
      let picks: PriorPick[];
      if (usable.length === carried.length && carried.length >= startingSize) {
        picks = usable;
      } else {
        const initial = buildInitialLineup(squad);
        picks = [...initial.starters, ...initial.bench].map((p, index) => ({
          playerId: p.id,
          slot: index + 1,
          isCaptain: p.id === initial.captainId,
          isVice: p.id === initial.viceId,
        }));
      }
      if (picks.length === 0) continue;

      const [lineup] = await tx
        .insert(gameweekLineups)
        .values({ fantasyTeamId: teamId, gameweekId })
        .onConflictDoNothing({
          target: [gameweekLineups.fantasyTeamId, gameweekLineups.gameweekId],
        })
        .returning();
      // Another call (or a manager saving) won the race — leave theirs.
      if (!lineup) continue;

      await tx.insert(lineupPicks).values(
        picks.map((pick) => ({
          lineupId: lineup.id,
          playerId: pick.playerId,
          slot: pick.slot,
          isCaptain: pick.isCaptain,
          isVice: pick.isVice,
        }))
      );
      created++;
    }
  });
  return created;
}
