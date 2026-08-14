/**
 * What number goes under each player once a gameweek has been played.
 *
 * Finalization banks a points snapshot on every pick, and that snapshot is the
 * authoritative figure — it is what the standings were built from. But a
 * gameweek can read as finished without ever having been finalized (an admin
 * can move the status by hand, and the backfill writes lineups with no points
 * for anyone who was scored before their row existed), and in that state the
 * pages had nothing to show: no snapshot meant no points at all, so a finished
 * gameweek fell back to printing each player's fixture, as if it were still to
 * be played.
 *
 * So: prefer the snapshot, compute from the match stats when there is none,
 * and always return a number for every pick. A player who didn't play, or
 * played and scored nothing, is a 0 — never a blank.
 */

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { resolveLineup, type EnginePick, type EngineSettings } from "./engine";
import { getGameweekPlayerStats } from "./queries";

export type ScorablePick = {
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isVice: boolean;
  /** Snapshot written by finalization; null until the gameweek is finalized. */
  bankedPoints?: number | null;
};

export type GameweekLineupPoints = {
  /** Effective points per player — captain multiplier applied, never missing. */
  pointsByPlayer: Record<string, number>;
  /** Who actually counted after auto-subs. */
  finalStarterIds: Set<string>;
  autoSubs: Array<[string, string]>;
};

const EMPTY: GameweekLineupPoints = {
  pointsByPlayer: {},
  finalStarterIds: new Set(),
  autoSubs: [],
};

export async function resolveGameweekLineupPoints(
  gameweekId: string,
  picks: ScorablePick[],
  settings: EngineSettings
): Promise<GameweekLineupPoints> {
  if (picks.length === 0) return EMPTY;

  // Positions come from the database rather than the caller's squad: a pick
  // can name a player who has since been transferred out, and the engine needs
  // every position to judge whether an auto-sub keeps the formation legal.
  const [stats, positionRows] = await Promise.all([
    getGameweekPlayerStats(gameweekId),
    db
      .select({ id: players.id, position: players.position })
      .from(players)
      .where(
        inArray(
          players.id,
          picks.map((p) => p.playerId)
        )
      ),
  ]);
  const positionById = new Map(positionRows.map((r) => [r.id, r.position]));

  const enginePicks: EnginePick[] = picks.map((pick) => ({
    playerId: pick.playerId,
    slot: pick.slot,
    isCaptain: pick.isCaptain,
    isVice: pick.isVice,
    // The foreign key guarantees the row; the fallback only satisfies the type.
    position: positionById.get(pick.playerId) ?? "MID",
    points: stats.get(pick.playerId)?.points ?? 0,
    minutes: stats.get(pick.playerId)?.minutes ?? 0,
  }));

  const resolved = resolveLineup(enginePicks, settings);

  const pointsByPlayer: Record<string, number> = {};
  for (const pick of picks) {
    pointsByPlayer[pick.playerId] =
      pick.bankedPoints ?? resolved.pickPoints.get(pick.playerId) ?? 0;
  }

  return {
    pointsByPlayer,
    finalStarterIds: resolved.finalStarterIds,
    autoSubs: resolved.autoSubs,
  };
}
