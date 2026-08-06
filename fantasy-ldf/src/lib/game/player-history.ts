/**
 * Builds a player's season record for the modal's gameweek stepper.
 *
 * Shared by the team page, rival team pages and the transfers market so every
 * surface explains a player identically — and so the arithmetic behind the
 * stepper lives in one testable place rather than three components.
 */

import { buildRuleLookup, explainPoints, type ScoringRuleRow } from "./scoring";
import type { GameweekStatLines } from "./queries";
import type { Position } from "./squad";
import type { PlayerGameweekRecord } from "@/components/team/player-modal";

export function buildPlayerHistory(
  playerId: string,
  position: Position,
  statsByGameweek: GameweekStatLines[],
  rule: (eventKey: string, position: Position) => number
): PlayerGameweekRecord[] {
  return statsByGameweek.map(({ gameweekId, number, lines }) => {
    const stats = lines[playerId];
    if (!stats) {
      // Gameweek played, this player didn't feature.
      return { gameweekId, number, breakdown: [], points: null };
    }
    const breakdown = explainPoints(stats, position, rule);
    return {
      gameweekId,
      number,
      breakdown,
      points: breakdown.reduce((total, row) => total + row.points, 0),
    };
  });
}

/** Convenience for components that hold raw rules rather than a lookup. */
export function makeHistoryBuilder(rules: ScoringRuleRow[] | undefined) {
  if (!rules) return null;
  const rule = buildRuleLookup(rules);
  return (
    playerId: string,
    position: Position,
    statsByGameweek: GameweekStatLines[]
  ) => buildPlayerHistory(playerId, position, statsByGameweek, rule);
}
