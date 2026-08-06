/**
 * Pure checks for the player-modal points breakdown. The contract that matters:
 * the itemised rows must always sum to computePoints, or the modal would
 * contradict the number on the player's card.
 *
 * Run: npx tsx scripts/verify-points-breakdown.ts
 */
import {
  buildRuleLookup,
  computePoints,
  explainPoints,
  type ScoringRuleRow,
  type StatLine,
} from "../src/lib/game/scoring";
import type { Position } from "../src/lib/game/squad";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok
        ? ""
        : `  → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
  );
}

// The default rule set the app seeds with.
const RULES: ScoringRuleRow[] = [
  { eventKey: "minutes_lt_60", position: null, points: 1 },
  { eventKey: "minutes_gte_60", position: null, points: 2 },
  { eventKey: "goal", position: "GK", points: 10 },
  { eventKey: "goal", position: "DEF", points: 6 },
  { eventKey: "goal", position: "MID", points: 5 },
  { eventKey: "goal", position: "FWD", points: 4 },
  { eventKey: "assist", position: null, points: 3 },
  { eventKey: "clean_sheet", position: "GK", points: 4 },
  { eventKey: "clean_sheet", position: "DEF", points: 4 },
  { eventKey: "clean_sheet", position: "MID", points: 1 },
  { eventKey: "clean_sheet", position: "FWD", points: 0 },
  { eventKey: "saves_per_3", position: null, points: 1 },
  { eventKey: "penalty_save", position: null, points: 5 },
  { eventKey: "penalty_miss", position: null, points: -2 },
  { eventKey: "goals_conceded_per_2", position: "GK", points: -1 },
  { eventKey: "goals_conceded_per_2", position: "DEF", points: -1 },
  { eventKey: "goals_conceded_per_2", position: "MID", points: 0 },
  { eventKey: "goals_conceded_per_2", position: "FWD", points: 0 },
  { eventKey: "yellow_card", position: null, points: -1 },
  { eventKey: "red_card", position: null, points: -3 },
  { eventKey: "own_goal", position: null, points: -2 },
];
const rule = buildRuleLookup(RULES);

const blank: StatLine = {
  minutes: 0,
  goals: 0,
  assists: 0,
  cleanSheet: false,
  saves: 0,
  penaltiesSaved: 0,
  penaltiesMissed: 0,
  goalsConceded: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  bonusPoints: 0,
};
const line = (over: Partial<StatLine>): StatLine => ({ ...blank, ...over });

const sum = (stats: StatLine, position: Position) =>
  explainPoints(stats, position, rule).reduce((n, row) => n + row.points, 0);
const keys = (stats: StatLine, position: Position) =>
  explainPoints(stats, position, rule).map((row) => row.key);

/** The core invariant, asserted for every scenario below. */
function checkSums(label: string, stats: StatLine, position: Position) {
  check(
    `${label} — rows sum to computePoints`,
    sum(stats, position),
    computePoints(stats, position, rule)
  );
}

console.log("\n-- rows always sum to the total --");
const keeper = line({
  minutes: 90,
  saves: 7,
  penaltiesSaved: 1,
  cleanSheet: true,
  bonusPoints: 3,
});
checkSums("GK: clean sheet, 7 saves, pen save", keeper, "GK");

const striker = line({
  minutes: 90,
  goals: 2,
  assists: 1,
  yellowCards: 1,
  goalsConceded: 3,
});
checkSums("FWD: brace, assist, booked", striker, "FWD");

const sub = line({ minutes: 25, goals: 1 });
checkSums("MID: sub who scored", sub, "MID");

const defender = line({
  minutes: 90,
  cleanSheet: true,
  ownGoals: 1,
  redCards: 1,
  goalsConceded: 0,
});
checkSums("DEF: clean sheet undone by an own goal and a red", defender, "DEF");

checkSums("unused sub", line({}), "MID");

console.log("\n-- only contributing categories appear --");
check(
  "GK breakdown lists exactly what happened",
  keys(keeper, "GK"),
  ["minutes", "cleanSheet", "saves", "penaltiesSaved", "bonus"]
);
check("no goals row without a goal", keys(keeper, "GK").includes("goals"), false);
check(
  "striker shows goals, assists, card and conceded",
  keys(striker, "FWD"),
  ["minutes", "goals", "assists", "goalsConceded", "yellowCards"]
);
check("didn't play → empty breakdown", explainPoints(line({}), "MID", rule), []);

console.log("\n-- bucketed categories --");
check(
  "2 saves is below the 3-save block, so no row",
  keys(line({ minutes: 90, saves: 2 }), "GK").includes("saves"),
  false
);
check(
  "6 saves counts two blocks",
  explainPoints(line({ minutes: 90, saves: 6 }), "GK", rule).find(
    (r) => r.key === "saves"
  ),
  { key: "saves", count: 6, points: 2 }
);
check(
  "1 goal conceded is below the 2-goal block, so no row",
  keys(line({ minutes: 90, goalsConceded: 1 }), "GK").includes("goalsConceded"),
  false
);
check(
  "clean sheet ignored under 60 minutes",
  keys(line({ minutes: 45, cleanSheet: true }), "DEF").includes("cleanSheet"),
  false
);
check(
  "minutes row switches to the under-60 rule",
  explainPoints(line({ minutes: 45 }), "MID", rule),
  [{ key: "minutes", count: 45, points: 1 }]
);

console.log(
  failures === 0 ? "\nAll breakdown checks pass." : `\n${failures} FAILED`
);
process.exitCode = failures === 0 ? 0 : 1;
