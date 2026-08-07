/**
 * Pure checks for the team page's gameweek navigation range and default
 * selection. Regression cover for the bug where a team created mid-season
 * could not reach any earlier gameweek — both nav arrows rendered dead.
 *
 * Run: npx tsx scripts/verify-team-gameweeks.ts
 */
import {
  buildViewableGameweeks,
  pickDefaultGameweek,
} from "../src/lib/game/team-gameweeks";
import type { TeamGameweek } from "../src/lib/game/queries";

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

const NOW = new Date("2026-08-05T18:00:00Z");
const daysAgo = (d: number) =>
  new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const daysAhead = (d: number) =>
  new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);

const gw = (
  number: number,
  status: TeamGameweek["status"],
  deadline: Date
): TeamGameweek => ({ id: `gw-${number}`, number, status, deadline });

// A season mid-flight: GW1/GW2 played out, GW3 in play, GW4 still to come.
const GW1 = gw(1, "finished", daysAgo(21));
const GW2 = gw(2, "finished", daysAgo(14));
const GW3 = gw(3, "upcoming", daysAgo(1)); // deadline passed = in play
const GW4 = gw(4, "upcoming", daysAhead(6));
const SEASON = [GW1, GW2, GW3, GW4];

const numbers = (list: TeamGameweek[]) => list.map((g) => g.number);

console.log("\n-- navigation range --");
check(
  "started gameweeks + the upcoming one",
  numbers(buildViewableGameweeks(SEASON, GW4, NOW)),
  [1, 2, 3, 4]
);
check(
  "range is independent of which lineups the team owns",
  // The reported bug: team created at GW3 still reaches GW1 and GW2.
  numbers(buildViewableGameweeks(SEASON, GW4, NOW)).includes(1),
  true
);
check(
  "future gameweeks past the next one are excluded",
  numbers(buildViewableGameweeks([...SEASON, gw(5, "upcoming", daysAhead(13))], GW4, NOW)),
  [1, 2, 3, 4]
);
check(
  "no upcoming gameweek: only started ones",
  numbers(buildViewableGameweeks(SEASON, null, NOW)),
  [1, 2, 3]
);
check(
  "brand-new season, nothing started yet",
  numbers(buildViewableGameweeks([GW4], GW4, NOW)),
  [4]
);
check("empty season", numbers(buildViewableGameweeks([], null, NOW)), []);

console.log("\n-- arrow availability --");
// The page enables an arrow when a neighbour exists in the viewable range.
const viewable = buildViewableGameweeks(SEASON, GW4, NOW);
const indexOf = (n: number) => viewable.findIndex((g) => g.number === n);
check("GW1 has no previous", indexOf(1) > 0, false);
check("GW1 has a next", indexOf(1) < viewable.length - 1, true);
check("GW3 has a previous", indexOf(3) > 0, true);
check("GW4 has a previous", indexOf(4) > 0, true);
check("GW4 has no next", indexOf(4) < viewable.length - 1, false);
check(
  "single-gameweek season disables both arrows",
  (() => {
    const one = buildViewableGameweeks([GW4], GW4, NOW);
    return [one.length, 0 > 0, 0 < one.length - 1];
  })(),
  [1, false, false]
);

console.log("\n-- default selection --");
check(
  "prefers the gameweek in play",
  pickDefaultGameweek(viewable, GW4, NOW)?.number,
  3
);
check(
  "falls back to upcoming when nothing is in play",
  pickDefaultGameweek(
    buildViewableGameweeks([GW1, GW2, GW4], GW4, NOW),
    GW4,
    NOW
  )?.number,
  4
);
check(
  "falls back to the latest when the season is over",
  pickDefaultGameweek(
    buildViewableGameweeks([GW1, GW2], null, NOW),
    null,
    NOW
  )?.number,
  2
);
check("no gameweeks at all", pickDefaultGameweek([], null, NOW), null);

console.log(
  failures === 0 ? "\nAll team gameweek checks pass." : `\n${failures} FAILED`
);
process.exitCode = failures === 0 ? 0 : 1;
