/**
 * Gameweek finalization rules: auto-substitutions and captain multiplier.
 * Pure logic — DB orchestration lives in the admin finalize action.
 *
 * FPL semantics:
 * - A starter who played 0 minutes is replaced by the highest-priority bench
 *   player who DID play, as long as the formation stays legal
 *   (bench slot 1 is the backup GK and only ever replaces the GK).
 * - Captain scores double. If the captain didn't play, the vice does.
 */

import type { Position } from "./squad";

export type EnginePick = {
  playerId: string;
  slot: number; // 1..startingSize starters, then bench in priority order
  isCaptain: boolean;
  isVice: boolean;
  position: Position;
  points: number; // raw gameweek points (all fixtures summed)
  minutes: number;
};

export type EngineSettings = {
  startingSize: number;
  minDef: number;
  minMid: number;
  minFwd: number;
};

export type ResolvedLineup = {
  /** playerIds whose points count after auto-subs. */
  finalStarterIds: Set<string>;
  /** Who received the x2 multiplier (captain, vice fallback, or nobody). */
  multiplierPlayerId: string | null;
  /** Effective contribution per pick (multiplier applied; non-counted picks keep raw points for display). */
  pickPoints: Map<string, number>;
  /** Sum of counted points incl. captain bonus, before transfer hits. */
  total: number;
  /** [outId, inId] auto-substitutions that were applied. */
  autoSubs: Array<[string, string]>;
};

function formationLegal(
  starters: EnginePick[],
  settings: EngineSettings
): boolean {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const pick of starters) counts[pick.position]++;
  return (
    counts.GK === 1 &&
    counts.DEF >= settings.minDef &&
    counts.MID >= settings.minMid &&
    counts.FWD >= settings.minFwd
  );
}

export function resolveLineup(
  picks: EnginePick[],
  settings: EngineSettings
): ResolvedLineup {
  const sorted = [...picks].sort((a, b) => a.slot - b.slot);
  let starters = sorted.slice(0, settings.startingSize);
  const bench = sorted.slice(settings.startingSize);
  const autoSubs: Array<[string, string]> = [];
  const benchUsed = new Set<string>();

  // 1. Goalkeeper: backup GK (first bench slot) replaces a 0-minute GK.
  const startingGk = starters.find((p) => p.position === "GK");
  const benchGk = bench.find((p) => p.position === "GK");
  if (
    startingGk &&
    startingGk.minutes === 0 &&
    benchGk &&
    benchGk.minutes > 0
  ) {
    starters = starters.map((p) => (p === startingGk ? benchGk : p));
    benchUsed.add(benchGk.playerId);
    autoSubs.push([startingGk.playerId, benchGk.playerId]);
  }

  // 2. Outfield: replace 0-minute starters with bench players (priority
  //    order) who played, keeping the formation legal.
  for (const starter of [...starters]) {
    if (starter.position === "GK" || starter.minutes > 0) continue;
    for (const candidate of bench) {
      if (candidate.position === "GK") continue;
      if (benchUsed.has(candidate.playerId)) continue;
      if (candidate.minutes === 0) continue;

      const next = starters.map((p) => (p === starter ? candidate : p));
      if (!formationLegal(next, settings)) continue;

      starters = next;
      benchUsed.add(candidate.playerId);
      autoSubs.push([starter.playerId, candidate.playerId]);
      break;
    }
  }

  const finalStarterIds = new Set(starters.map((p) => p.playerId));

  // 3. Captain multiplier: captain if they played, otherwise vice.
  const captain = picks.find((p) => p.isCaptain);
  const vice = picks.find((p) => p.isVice);
  let multiplierPlayerId: string | null = null;
  if (
    captain &&
    captain.minutes > 0 &&
    finalStarterIds.has(captain.playerId)
  ) {
    multiplierPlayerId = captain.playerId;
  } else if (
    vice &&
    vice.minutes > 0 &&
    finalStarterIds.has(vice.playerId)
  ) {
    multiplierPlayerId = vice.playerId;
  }

  // 4. Totals + per-pick effective points.
  const pickPoints = new Map<string, number>();
  let total = 0;
  for (const pick of picks) {
    const counted = finalStarterIds.has(pick.playerId);
    const multiplied = pick.playerId === multiplierPlayerId;
    const effective = counted ? pick.points * (multiplied ? 2 : 1) : pick.points;
    pickPoints.set(pick.playerId, effective);
    if (counted) total += effective;
  }

  return { finalStarterIds, multiplierPlayerId, pickPoints, total, autoSubs };
}
