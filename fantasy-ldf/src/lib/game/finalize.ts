/**
 * Gameweek finalization orchestration (DB side of the engine).
 * No auth here — callers must gate access (admin action / dev scripts).
 */

import * as Sentry from "@sentry/nextjs";
import { and, asc, count, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fantasyTeams,
  fixtures,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  players,
} from "@/db/schema";
import { resolveLineup, type EnginePick } from "./engine";
import { getActiveSeasonContext } from "./queries";

export type FinalizeError =
  | "validation"
  | "already_finished"
  | "not_locked"
  | "fixtures_pending"
  | "unknown";

export type FinalizeResult = { error?: FinalizeError; teams?: number };

export async function runFinalizeGameweek(
  gameweekId: string
): Promise<FinalizeResult> {
  const { season, settings } = await getActiveSeasonContext();

  const [gameweek] = await db
    .select()
    .from(gameweeks)
    .where(
      and(eq(gameweeks.id, gameweekId), eq(gameweeks.seasonId, season.id))
    )
    .limit(1);
  if (!gameweek) return { error: "validation" };
  if (gameweek.status === "finished") return { error: "already_finished" };
  if (gameweek.deadline > new Date()) return { error: "not_locked" };

  // Every fixture must have a published result — a live or scheduled one means
  // stats are still missing, and finalizing would bank incomplete points.
  const [pendingFixtures] = await db
    .select({ n: count() })
    .from(fixtures)
    .where(
      and(eq(fixtures.gameweekId, gameweekId), ne(fixtures.status, "finished"))
    );
  if (pendingFixtures.n > 0) return { error: "fixtures_pending" };

  // Raw gameweek points + minutes per player (covers double gameweeks).
  const statRows = await db
    .select({
      playerId: playerMatchStats.playerId,
      points: sql<number>`sum(${playerMatchStats.points})::int`,
      minutes: sql<number>`sum(${playerMatchStats.minutes})::int`,
    })
    .from(playerMatchStats)
    .innerJoin(fixtures, eq(playerMatchStats.fixtureId, fixtures.id))
    .where(eq(fixtures.gameweekId, gameweekId))
    .groupBy(playerMatchStats.playerId);
  const statByPlayer = new Map(statRows.map((r) => [r.playerId, r]));

  // All lineups of this gameweek with their picks + positions.
  const pickRows = await db
    .select({
      lineupId: gameweekLineups.id,
      fantasyTeamId: gameweekLineups.fantasyTeamId,
      transfersCost: gameweekLineups.transfersCost,
      pickId: lineupPicks.id,
      playerId: lineupPicks.playerId,
      slot: lineupPicks.slot,
      isCaptain: lineupPicks.isCaptain,
      isVice: lineupPicks.isVice,
      position: players.position,
    })
    .from(gameweekLineups)
    .innerJoin(lineupPicks, eq(lineupPicks.lineupId, gameweekLineups.id))
    .innerJoin(players, eq(players.id, lineupPicks.playerId))
    .where(eq(gameweekLineups.gameweekId, gameweekId));

  const lineups = new Map<
    string,
    {
      fantasyTeamId: string;
      transfersCost: number;
      picks: Array<EnginePick & { pickId: string }>;
    }
  >();
  for (const row of pickRows) {
    let lineup = lineups.get(row.lineupId);
    if (!lineup) {
      lineup = {
        fantasyTeamId: row.fantasyTeamId,
        transfersCost: row.transfersCost,
        picks: [],
      };
      lineups.set(row.lineupId, lineup);
    }
    const stat = statByPlayer.get(row.playerId);
    lineup.picks.push({
      pickId: row.pickId,
      playerId: row.playerId,
      slot: row.slot,
      isCaptain: row.isCaptain,
      isVice: row.isVice,
      position: row.position,
      points: stat?.points ?? 0,
      minutes: stat?.minutes ?? 0,
    });
  }

  // Next gameweek for the lineup rollover.
  const [nextGameweek] = await db
    .select({ id: gameweeks.id })
    .from(gameweeks)
    .where(
      and(
        eq(gameweeks.seasonId, season.id),
        gt(gameweeks.number, gameweek.number)
      )
    )
    .orderBy(asc(gameweeks.number))
    .limit(1);

  const engineSettings = {
    startingSize: settings.startingSize,
    minDef: settings.minDef,
    minMid: settings.minMid,
    minFwd: settings.minFwd,
  };

  try {
    await db.transaction(async (tx) => {
      for (const [lineupId, lineup] of lineups) {
        const resolved = resolveLineup(lineup.picks, engineSettings);
        const net = resolved.total - lineup.transfersCost;

        for (const pick of lineup.picks) {
          await tx
            .update(lineupPicks)
            .set({ points: resolved.pickPoints.get(pick.playerId) ?? 0 })
            .where(eq(lineupPicks.id, pick.pickId));
        }

        await tx
          .update(gameweekLineups)
          .set({ points: net })
          .where(eq(gameweekLineups.id, lineupId));

        await tx
          .update(fantasyTeams)
          .set({ totalPoints: sql`${fantasyTeams.totalPoints} + ${net}` })
          .where(eq(fantasyTeams.id, lineup.fantasyTeamId));

        // Roll the lineup forward to the next gameweek (same picks).
        if (nextGameweek) {
          const [existing] = await tx
            .select({ id: gameweekLineups.id })
            .from(gameweekLineups)
            .where(
              and(
                eq(gameweekLineups.fantasyTeamId, lineup.fantasyTeamId),
                eq(gameweekLineups.gameweekId, nextGameweek.id)
              )
            )
            .limit(1);
          if (!existing) {
            const [rolled] = await tx
              .insert(gameweekLineups)
              .values({
                fantasyTeamId: lineup.fantasyTeamId,
                gameweekId: nextGameweek.id,
              })
              .returning();
            await tx.insert(lineupPicks).values(
              lineup.picks.map((pick) => ({
                lineupId: rolled.id,
                playerId: pick.playerId,
                slot: pick.slot,
                isCaptain: pick.isCaptain,
                isVice: pick.isVice,
              }))
            );
          }
        }
      }

      // Everyone banks one more free transfer (capped).
      await tx
        .update(fantasyTeams)
        .set({
          freeTransfers: sql`least(${fantasyTeams.freeTransfers} + ${settings.freeTransfersPerGw}, ${settings.maxBankedTransfers})`,
        })
        .where(eq(fantasyTeams.seasonId, season.id));

      // Global ranks.
      await tx.execute(sql`
        update fantasy_teams ft
        set overall_rank = ranked.rnk
        from (
          select id, rank() over (order by total_points desc, created_at asc) as rnk
          from fantasy_teams
          where season_id = ${season.id}
        ) ranked
        where ft.id = ranked.id
      `);

      await tx
        .update(gameweeks)
        .set({ status: "finished", finalizedAt: new Date() })
        .where(eq(gameweeks.id, gameweekId));
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("finalizeGameweek failed:", err);
    return { error: "unknown" };
  }

  return { teams: lineups.size };
}
