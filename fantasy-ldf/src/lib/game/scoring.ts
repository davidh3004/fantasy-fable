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

/** One scoring category that actually contributed to a player's total. */
export type BreakdownRow = {
  /** Matches an i18n key under team.breakdown.* */
  key: string;
  /** How many times it counted — goals scored, save blocks of 3, etc. */
  count: number;
  points: number;
};

/**
 * The same arithmetic as computePoints, itemised — so the modal can show *how*
 * a player earned their points and the rows always sum to the number on the
 * card. Categories that contributed nothing are left out entirely.
 */
export function explainPoints(
  stats: StatLine,
  position: Position,
  rule: (eventKey: string, position: Position) => number
): BreakdownRow[] {
  if (stats.minutes <= 0) return [];

  const rows: BreakdownRow[] = [];
  const add = (key: string, count: number, points: number) => {
    // A category counts if it happened, even when its rule is worth 0 points.
    if (count !== 0) rows.push({ key, count, points });
  };

  add(
    "minutes",
    stats.minutes,
    stats.minutes >= 60
      ? rule("minutes_gte_60", position)
      : rule("minutes_lt_60", position)
  );
  add("goals", stats.goals, stats.goals * rule("goal", position));
  add("assists", stats.assists, stats.assists * rule("assist", position));

  if (stats.cleanSheet && stats.minutes >= 60) {
    add("cleanSheet", 1, rule("clean_sheet", position));
  }

  const saveBlocks = Math.floor(stats.saves / 3);
  if (saveBlocks > 0) {
    add("saves", stats.saves, saveBlocks * rule("saves_per_3", position));
  }

  add(
    "penaltiesSaved",
    stats.penaltiesSaved,
    stats.penaltiesSaved * rule("penalty_save", position)
  );
  add(
    "penaltiesMissed",
    stats.penaltiesMissed,
    stats.penaltiesMissed * rule("penalty_miss", position)
  );

  const concededBlocks = Math.floor(stats.goalsConceded / 2);
  if (concededBlocks > 0) {
    add(
      "goalsConceded",
      stats.goalsConceded,
      concededBlocks * rule("goals_conceded_per_2", position)
    );
  }

  add(
    "yellowCards",
    stats.yellowCards,
    stats.yellowCards * rule("yellow_card", position)
  );
  add("redCards", stats.redCards, stats.redCards * rule("red_card", position));
  add("ownGoals", stats.ownGoals, stats.ownGoals * rule("own_goal", position));
  add("bonus", stats.bonusPoints, stats.bonusPoints);

  return rows;
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
