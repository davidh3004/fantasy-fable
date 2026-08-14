/**
 * One source of truth for "what did this team score in this gameweek", so the
 * home dashboard, the team page and the standings can't drift apart.
 *
 * - finished  → the snapshot written by the finalize engine (already net of
 *               hits), or recomputed when the gameweek was never finalized
 * - live      → recomputed on the fly with auto-subs + captain, minus hits
 * - upcoming  → null (nothing has been played yet)
 */

import { resolveLineup, type EnginePick } from "./engine";
import {
  getGameweekPlayerStats,
  getLineupSummary,
  getManagerLineup,
} from "./queries";
import type { SquadSettings } from "./squad";

export type GameweekLike = {
  id: string;
  status: "upcoming" | "locked" | "finished";
  deadline: Date;
};

export async function getTeamGameweekPoints(
  fantasyTeamId: string,
  gameweek: GameweekLike,
  settings: SquadSettings
): Promise<number | null> {
  const finished = gameweek.status === "finished";

  // Not played yet: only meaningful once the deadline has locked the squad.
  if (!finished && gameweek.deadline > new Date()) return null;

  const [picks, stats, summary] = await Promise.all([
    getManagerLineup(fantasyTeamId, gameweek.id),
    getGameweekPlayerStats(gameweek.id),
    getLineupSummary(fantasyTeamId, gameweek.id),
  ]);

  // The banked figure wins whenever finalization wrote one — it is what the
  // team's season total and the standings were built from.
  if (finished && summary?.points != null) return summary.points;

  // Otherwise compute it. A gameweek reads as finished the moment its status
  // says so, which an admin can set by hand without ever finalizing, and a
  // lineup frozen at the deadline after a finalize has no snapshot either.
  // Recomputing beats showing nothing, and matches the pitch below it.
  if (picks.length === 0) return null;

  const enginePicks: EnginePick[] = picks.map((pick) => ({
    playerId: pick.id,
    slot: pick.slot,
    isCaptain: pick.isCaptain,
    isVice: pick.isVice,
    position: pick.position,
    points: stats.get(pick.id)?.points ?? 0,
    minutes: stats.get(pick.id)?.minutes ?? 0,
  }));

  const resolved = resolveLineup(enginePicks, settings);
  return resolved.total - (summary?.transfersCost ?? 0);
}
