/**
 * Gameweek finalization orchestration (DB side of the engine).
 * No auth here — callers must gate access (admin action / dev scripts).
 */

import * as Sentry from "@sentry/nextjs";
import { and, asc, count, eq, gt, inArray, lt, ne, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fantasyTeams,
  fixtures,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  players,
  squadPicks,
} from "@/db/schema";
import { resolveLineup, type EnginePick } from "./engine";
import { buildInitialLineup, type PickablePlayer } from "./squad";
import { getActiveSeasonContext } from "./queries";

export type FinalizeError =
  | "validation"
  | "already_finished"
  | "not_locked"
  | "fixtures_pending"
  | "unknown";

export type FinalizeResult = { error?: FinalizeError; teams?: number };

export type UnfinalizeError =
  | "validation"
  | "not_finished"
  | "later_finalized"
  | "unknown";

/**
 * Guarantees every team in the season has a lineup for this gameweek before
 * it's scored.
 *
 * Onboarding writes a lineup and finalize rolls it forward, so most teams
 * already have one. The gaps are teams that never got that far — one created
 * while no gameweek was upcoming, or any team when a gameweek is added *after*
 * the previous one was finalized, which leaves the whole league with nothing to
 * roll forward into. Those teams would otherwise score zero and read as "no
 * lineup" forever, purely for not having touched a screen.
 *
 * Their most recent earlier lineup is carried forward when there is one, so a
 * manager keeps their captain and bench order rather than being reset to a
 * price-ranked default. Picks are reconciled against the current squad — a
 * player since transferred out can't be fielded — and anything short of a full
 * XI falls back to the default build.
 *
 * Teams with no squad are skipped: they don't exist as far as this gameweek is
 * concerned, which is the honest "no lineup" the manager page should show.
 */
async function ensureLineupsForGameweek(
  gameweekId: string,
  seasonId: string,
  startingSize: number
): Promise<number> {
  const missing = await db
    .select({ id: fantasyTeams.id })
    .from(fantasyTeams)
    .where(
      and(
        eq(fantasyTeams.seasonId, seasonId),
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
      // Another finalize (or a manager saving) won the race — leave theirs.
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

/**
 * Reverses runFinalizeGameweek so a wrong result can be corrected.
 *
 * Points come back off every team's total using the per-lineup figure that was
 * banked, so this stays exact even if scoring rules changed in between. The
 * rollover lineups it created for the next gameweek are deliberately left in
 * place — managers may have edited them or made transfers since, and
 * re-finalizing skips lineups that already exist.
 *
 * Free transfers are the one inexact part: finalize caps them with `least(...)`,
 * so a team already at the cap gives back one it never gained. Small, and it
 * re-banks on the next finalize.
 */
export async function runUnfinalizeGameweek(
  gameweekId: string
): Promise<{ error?: UnfinalizeError; teams?: number }> {
  const { season, settings } = await getActiveSeasonContext();

  const [gameweek] = await db
    .select()
    .from(gameweeks)
    .where(
      and(eq(gameweeks.id, gameweekId), eq(gameweeks.seasonId, season.id))
    )
    .limit(1);
  if (!gameweek) return { error: "validation" };
  if (gameweek.status !== "finished") return { error: "not_finished" };

  // Unwinding out of order would corrupt totals: a later gameweek's points sit
  // on top of this one's in every team's running total.
  const [laterFinalized] = await db
    .select({ n: count() })
    .from(gameweeks)
    .where(
      and(
        eq(gameweeks.seasonId, season.id),
        gt(gameweeks.number, gameweek.number),
        eq(gameweeks.status, "finished")
      )
    );
  if (laterFinalized.n > 0) return { error: "later_finalized" };

  const lineupRows = await db
    .select({
      id: gameweekLineups.id,
      fantasyTeamId: gameweekLineups.fantasyTeamId,
      points: gameweekLineups.points,
    })
    .from(gameweekLineups)
    .where(eq(gameweekLineups.gameweekId, gameweekId));

  try {
    await db.transaction(async (tx) => {
      for (const lineup of lineupRows) {
        if (lineup.points != null) {
          await tx
            .update(fantasyTeams)
            .set({
              totalPoints: sql`${fantasyTeams.totalPoints} - ${lineup.points}`,
            })
            .where(eq(fantasyTeams.id, lineup.fantasyTeamId));
        }

        await tx
          .update(lineupPicks)
          .set({ points: null })
          .where(eq(lineupPicks.lineupId, lineup.id));

        await tx
          .update(gameweekLineups)
          .set({ points: null })
          .where(eq(gameweekLineups.id, lineup.id));
      }

      // Hand back the free transfer this finalize granted.
      await tx
        .update(fantasyTeams)
        .set({
          freeTransfers: sql`greatest(${fantasyTeams.freeTransfers} - ${settings.freeTransfersPerGw}, 0)`,
        })
        .where(eq(fantasyTeams.seasonId, season.id));

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

      // Back to in play — the deadline has passed, so it derives as live.
      await tx
        .update(gameweeks)
        .set({ status: "locked", finalizedAt: null })
        .where(eq(gameweeks.id, gameweekId));
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("unfinalizeGameweek failed:", err);
    return { error: "unknown" };
  }

  return { teams: lineupRows.length };
}

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

  // Teams that never saved a lineup get one now, so they're scored and show
  // up in history like everyone else. Must run before the read below.
  await ensureLineupsForGameweek(gameweekId, season.id, settings.startingSize);

  // Every lineup of this gameweek, then its picks. Fetched separately on
  // purpose: joining the two would drop a lineup row that has no picks, and
  // that team would silently get no points and — worse — no roll-forward, so
  // they'd vanish from every later gameweek.
  const lineupRows = await db
    .select({
      id: gameweekLineups.id,
      fantasyTeamId: gameweekLineups.fantasyTeamId,
      transfersCost: gameweekLineups.transfersCost,
    })
    .from(gameweekLineups)
    .where(eq(gameweekLineups.gameweekId, gameweekId));

  const lineups = new Map<
    string,
    {
      fantasyTeamId: string;
      transfersCost: number;
      picks: Array<EnginePick & { pickId: string }>;
    }
  >(
    lineupRows.map((row) => [
      row.id,
      {
        fantasyTeamId: row.fantasyTeamId,
        transfersCost: row.transfersCost,
        picks: [],
      },
    ])
  );

  const pickRows =
    lineupRows.length === 0
      ? []
      : await db
          .select({
            lineupId: lineupPicks.lineupId,
            pickId: lineupPicks.id,
            playerId: lineupPicks.playerId,
            slot: lineupPicks.slot,
            isCaptain: lineupPicks.isCaptain,
            isVice: lineupPicks.isVice,
            position: players.position,
          })
          .from(lineupPicks)
          .innerJoin(players, eq(players.id, lineupPicks.playerId))
          .where(
            inArray(
              lineupPicks.lineupId,
              lineupRows.map((row) => row.id)
            )
          );

  for (const row of pickRows) {
    const stat = statByPlayer.get(row.playerId);
    lineups.get(row.lineupId)?.picks.push({
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
            // Guarded: inserting an empty array throws.
            if (lineup.picks.length > 0) {
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
