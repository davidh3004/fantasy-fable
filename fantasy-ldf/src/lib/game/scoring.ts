/**
 * Pure scoring rules: stat line → fantasy points, driven entirely by the
 * scoring_rules table. Shared by admin stat entry and the gameweek engine.
 */

import type { Position } from "./squad";

export type StatLine = {
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
};

export type ScoringRuleRow = {
  eventKey: string;
  position: Position | null;
  points: number;
};

/** position-specific rule wins over the catch-all (position = null). */
export function buildRuleLookup(rules: ScoringRuleRow[]) {
  const map = new Map<string, number>();
  for (const rule of rules) {
    map.set(`${rule.eventKey}:${rule.position ?? "*"}`, rule.points);
  }
  return (eventKey: string, position: Position): number =>
    map.get(`${eventKey}:${position}`) ?? map.get(`${eventKey}:*`) ?? 0;
}

export function computePoints(
  stats: StatLine,
  position: Position,
  rule: (eventKey: string, position: Position) => number
): number {
  if (stats.minutes <= 0) return 0;

  let points = 0;

  points +=
    stats.minutes >= 60
      ? rule("minutes_gte_60", position)
      : rule("minutes_lt_60", position);

  points += stats.goals * rule("goal", position);
  points += stats.assists * rule("assist", position);

  if (stats.cleanSheet && stats.minutes >= 60) {
    points += rule("clean_sheet", position);
  }

  points += Math.floor(stats.saves / 3) * rule("saves_per_3", position);
  points += stats.penaltiesSaved * rule("penalty_save", position);
  points += stats.penaltiesMissed * rule("penalty_miss", position);
  points +=
    Math.floor(stats.goalsConceded / 2) *
    rule("goals_conceded_per_2", position);
  points += stats.yellowCards * rule("yellow_card", position);
  points += stats.redCards * rule("red_card", position);
  points += stats.ownGoals * rule("own_goal", position);

  points += stats.bonusPoints;

  return points;
}
