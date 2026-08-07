/**
 * One source of truth for "what did this team score in this gameweek", so the
 * home dashboard, the team page and the standings can't drift apart.
 *
 * - finished  → the snapshot written by the finalize engine (already net of hits)
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
  if (gameweek.status === "finished") {
    const summary = await getLineupSummary(fantasyTeamId, gameweek.id);
    return summary?.points ?? null;
  }

  // Not finalized yet: only meaningful once the deadline has locked the squad.
  if (gameweek.deadline > new Date()) return null;

  const [picks, stats, summary] = await Promise.all([
    getManagerLineup(fantasyTeamId, gameweek.id),
    getGameweekPlayerStats(gameweek.id),
    getLineupSummary(fantasyTeamId, gameweek.id),
  ]);
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
