/**
 * Gameweek finalization orchestration (DB side of the engine).
 * No auth here — callers must gate access (admin action / dev scripts).
 */

import * as Sentry from "@sentry/nextjs";
import { and, asc, count, eq, gt, inArray, ne, sql } from "drizzle-orm";
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
import { ensureLineupsForGameweek } from "./ensure-lineups";

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
/**
 * Postgres takes 65535 bind parameters per statement; these carry two or three
 * each, so the ceiling is far above a league. Kept well under it anyway.
 */
const WRITE_CHUNK = 4000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Sets one integer column on many rows in a single statement, instead of one
 * UPDATE per row. `update ... from (values ...)` is the standard shape for it.
 */
async function bulkSetInt(
  tx: Tx,
  table: "lineup_picks" | "gameweek_lineups",
  rows: [string, number][]
): Promise<void> {
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const chunk = rows.slice(i, i + WRITE_CHUNK);
    const values = chunk.map(([id, points]) => sql`(${id}::uuid, ${points}::int)`);
    const target = table === "lineup_picks" ? sql`lineup_picks` : sql`gameweek_lineups`;
    await tx.execute(sql`
      update ${target} as t set points = v.points
      from (values ${sql.join(values, sql`, `)}) as v(id, points)
      where t.id = v.id
    `);
  }
}

/** Same idea, but adding to the existing value rather than replacing it. */
async function bulkAddInt(
  tx: Tx,
  table: "fantasy_teams",
  column: "total_points",
  rows: [string, number][]
): Promise<void> {
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const chunk = rows.slice(i, i + WRITE_CHUNK);
    const values = chunk.map(([id, delta]) => sql`(${id}::uuid, ${delta}::int)`);
    void table;
    void column;
    await tx.execute(sql`
      update fantasy_teams as t set total_points = t.total_points + v.delta
      from (values ${sql.join(values, sql`, `)}) as v(id, delta)
      where t.id = v.id
    `);
  }
}

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

      // Both SET expressions read the pre-update row, so the old rank shifts
      // into previous_overall_rank in the same statement that overwrites it.
      await tx.execute(sql`
        update fantasy_teams ft
        set previous_overall_rank = ft.overall_rank,
            overall_rank = ranked.rnk
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
    /**
     * Scoring stays in JavaScript — resolveLineup is the game's rules and is
     * not worth rewriting in SQL. What changes is the writing: the previous
     * shape issued around twenty statements per team, fifteen of them one
     * UPDATE per pick, which is twenty thousand sequential round trips for a
     * thousand-team league inside one open transaction. Every result below is
     * computed first, then written in a fixed handful of statements.
     */
    const pickPoints: [string, number][] = [];
    const lineupPointRows: [string, number][] = [];
    const teamDeltas: [string, number][] = [];
    const rollForward: {
      fantasyTeamId: string;
      picks: Array<EnginePick & { pickId: string }>;
    }[] = [];

    for (const [lineupId, lineup] of lineups) {
      const resolved = resolveLineup(lineup.picks, engineSettings);
      const net = resolved.total - lineup.transfersCost;

      for (const pick of lineup.picks) {
        pickPoints.push([
          pick.pickId,
          resolved.pickPoints.get(pick.playerId) ?? 0,
        ]);
      }
      lineupPointRows.push([lineupId, net]);
      teamDeltas.push([lineup.fantasyTeamId, net]);
      if (nextGameweek && lineup.picks.length > 0) {
        rollForward.push({
          fantasyTeamId: lineup.fantasyTeamId,
          picks: lineup.picks,
        });
      }
    }

    await db.transaction(async (tx) => {
      // Each of these is one statement per chunk rather than one per row.
      await bulkSetInt(tx, "lineup_picks", pickPoints);
      await bulkSetInt(tx, "gameweek_lineups", lineupPointRows);
      await bulkAddInt(tx, "fantasy_teams", "total_points", teamDeltas);

      // Roll every lineup forward to the next gameweek, same picks. The
      // per-team "does it exist yet" check is gone: onConflictDoNothing
      // answers it for the whole league in one statement, and returning()
      // names exactly the rows this transaction created.
      if (nextGameweek && rollForward.length > 0) {
        const rolled = await tx
          .insert(gameweekLineups)
          .values(
            rollForward.map((r) => ({
              fantasyTeamId: r.fantasyTeamId,
              gameweekId: nextGameweek.id,
            }))
          )
          .onConflictDoNothing({
            target: [gameweekLineups.fantasyTeamId, gameweekLineups.gameweekId],
          })
          .returning({
            id: gameweekLineups.id,
            fantasyTeamId: gameweekLineups.fantasyTeamId,
          });

        const picksByTeam = new Map(
          rollForward.map((r) => [r.fantasyTeamId, r.picks])
        );
        const rows = rolled.flatMap((lineup) =>
          (picksByTeam.get(lineup.fantasyTeamId) ?? []).map((pick) => ({
            lineupId: lineup.id,
            playerId: pick.playerId,
            slot: pick.slot,
            isCaptain: pick.isCaptain,
            isVice: pick.isVice,
          }))
        );
        for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
          await tx.insert(lineupPicks).values(rows.slice(i, i + WRITE_CHUNK));
        }
      }

      // Everyone banks one more free transfer (capped).
      await tx
        .update(fantasyTeams)
        .set({
          freeTransfers: sql`least(${fantasyTeams.freeTransfers} + ${settings.freeTransfersPerGw}, ${settings.maxBankedTransfers})`,
        })
        .where(eq(fantasyTeams.seasonId, season.id));

      // Global ranks. previous_overall_rank is cleared rather than restored:
      // the value from before the finalize we're undoing is unrecoverable, and
      // a null shows no movement arrow instead of a wrong one.
      await tx.execute(sql`
        update fantasy_teams ft
        set previous_overall_rank = null,
            overall_rank = ranked.rnk
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
