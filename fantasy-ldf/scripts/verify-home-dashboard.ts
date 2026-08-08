/**
 * Pure checks for the home dashboard's derived numbers. These are the pieces
 * that are easy to get subtly wrong and invisible until they're wrong on
 * screen: which day a kickoff belongs to, how much of your XI has played, and
 * where you sit against the league.
 *
 * Run: npx tsx scripts/verify-home-dashboard.ts
 */
import {
  captainNotPlayed,
  groupByDay,
  leagueAverage,
  playersPlayed,
  topScorer,
  unavailablePlayers,
  type PlayerStat,
} from "../src/lib/game/dashboard";
import { resolveLineup, type EnginePick } from "../src/lib/game/engine";
import type { Position } from "../src/lib/game/squad";
import { leagueDayOffset } from "../src/lib/game/format";
import type { MarketPlayer } from "../src/lib/game/queries";
import type { StandingRow } from "../src/lib/game/leagues";

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

const player = (over: Partial<MarketPlayer> & { id: string }): MarketPlayer => ({
  firstName: "A",
  lastName: "B",
  position: "MID",
  price: 50,
  status: "available",
  clubId: "c1",
  clubShortName: "CLB",
  clubName: "Club",
  clubColor: null,
  clubBadgeUrl: null,
  photoUrl: null,
  ...over,
});

const SETTINGS = {
  startingSize: 11,
  minDef: 3,
  minMid: 2,
  minFwd: 1,
};

/** A legal XI plus a four-man bench, so resolveLineup has something real. */
function lineup(
  over: Partial<Record<string, { points?: number; minutes?: number }>> = {},
  roles: { captain?: string; vice?: string } = {}
): EnginePick[] {
  const shape: Array<[string, Position]> = [
    ["gk", "GK"],
    ["d1", "DEF"], ["d2", "DEF"], ["d3", "DEF"], ["d4", "DEF"],
    ["m1", "MID"], ["m2", "MID"], ["m3", "MID"], ["m4", "MID"],
    ["f1", "FWD"], ["f2", "FWD"],
    // bench: backup GK first, then outfield in priority order
    ["gk2", "GK"], ["d5", "DEF"], ["m5", "MID"], ["f3", "FWD"],
  ];
  return shape.map(([id, position], index) => ({
    playerId: id,
    slot: index + 1,
    isCaptain: roles.captain === id,
    isVice: roles.vice === id,
    position,
    points: over[id]?.points ?? 0,
    minutes: over[id]?.minutes ?? 90,
  }));
}

const pick = (playerId: string, isCaptain = false) => ({
  playerId,
  isCaptain,
});

const stats = (entries: Record<string, PlayerStat>) =>
  new Map(Object.entries(entries));

const standing = (over: Partial<StandingRow>): StandingRow => ({
  rank: 1,
  fantasyTeamId: "t1",
  teamName: "T",
  managerName: "M",
  gwPoints: 0,
  totalPoints: 0,
  isMe: false,
  movement: null,
  ...over,
});

// ---------------------------------------------------------------------------
console.log("\n-- league day bucketing (America/Santo_Domingo, UTC-4) --");
// 9pm AST on Oct 12 is 01:00 UTC on Oct 13 — the naive UTC comparison the
// helper exists to avoid would call this "tomorrow".
const lateKickoff = new Date("2025-10-13T01:00:00Z"); // 21:00 AST Oct 12
const eveningNow = new Date("2025-10-12T23:00:00Z"); // 19:00 AST Oct 12
check("a 9pm kickoff is still today at 7pm", leagueDayOffset(lateKickoff, eveningNow), 0);

check(
  "next-day kickoff reads as tomorrow",
  leagueDayOffset(new Date("2025-10-14T01:00:00Z"), eveningNow),
  1
);
check(
  "month boundary counts as one day, not a rollover to 0",
  leagueDayOffset(new Date("2025-11-01T18:00:00Z"), new Date("2025-10-31T18:00:00Z")),
  1
);
check(
  "a finished match yesterday is negative",
  leagueDayOffset(new Date("2025-10-11T18:00:00Z"), eveningNow),
  -1
);

const grouped = groupByDay(
  [
    { id: "late", kickoff: new Date("2025-10-14T20:00:00Z") },
    { id: "early", kickoff: new Date("2025-10-12T18:00:00Z") },
    { id: "mid", kickoff: new Date("2025-10-12T22:00:00Z") },
  ],
  eveningNow
);
check(
  "days come back in order, fixtures sorted inside each",
  grouped.map((d) => [d.offset, d.fixtures.map((f) => f.id)]),
  [
    [0, ["early", "mid"]],
    [2, ["late"]],
  ]
);
check("no fixtures yields no day headers", groupByDay([], eveningNow), []);

// ---------------------------------------------------------------------------
console.log("\n-- players played --");
check(
  "counts the counting XI who took the pitch",
  playersPlayed(
    resolveLineup(
      lineup({ gk: { minutes: 90 }, d1: { minutes: 45 }, d2: { minutes: 0 } }),
      SETTINGS
    ),
    stats({ gk: { points: 2, minutes: 90 }, d1: { points: 2, minutes: 45 } }),
    11
  ),
  { played: 2, total: 11 }
);
check(
  "no lineup at all yields null, not a zero row",
  playersPlayed(null, stats({}), 11),
  null
);

console.log("\n-- captain --");
check(
  "the named captain who hasn't played is flagged",
  captainNotPlayed(
    [pick("f1", true), pick("m1")],
    stats({ m1: { points: 6, minutes: 90 } })
  ),
  "f1"
);
check(
  "captain who played is not flagged",
  captainNotPlayed([pick("f1", true)], stats({ f1: { points: 6, minutes: 12 } })),
  null
);
check("no captain, nothing to flag", captainNotPlayed([pick("f1")], stats({})), null);

console.log("\n-- league average --");
check(
  "averages only teams that have a score",
  leagueAverage([
    standing({ gwPoints: 40 }),
    standing({ gwPoints: 50 }),
    standing({ gwPoints: null }),
  ]),
  45
);
check("no scores yet → null, not a divide by zero", leagueAverage([standing({ gwPoints: null })]), null);
check("empty standings → null", leagueAverage([]), null);

// ---------------------------------------------------------------------------
console.log("\n-- top scorer --");
const squadById = new Map(
  ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2", "gk2", "d5", "m5", "f3"].map(
    (id) => [id, player({ id })]
  )
);

check(
  "captain doubling can decide the top scorer",
  (() => {
    const r = resolveLineup(
      lineup({ f1: { points: 6 }, m1: { points: 9 } }, { captain: "f1", vice: "m1" }),
      SETTINGS
    );
    const top = topScorer(r, squadById);
    return top && { id: top.player.id, points: top.points, isCaptain: top.isCaptain };
  })(),
  { id: "f1", points: 12, isCaptain: true }
);

// The regression: a team created after the gameweek started has a squad but no
// lineup, and must not be credited with points its players earned regardless.
check(
  "no lineup → no top scorer, however well the squad's players did",
  topScorer(null, squadById),
  null
);
check(
  "nobody has scored yet → null rather than a 0-point top scorer",
  topScorer(resolveLineup(lineup(), SETTINGS), squadById),
  null
);
check(
  "a benched player who never came on is never top scorer",
  (() => {
    const r = resolveLineup(lineup({ f3: { points: 20 }, f1: { points: 4 } }), SETTINGS);
    const top = topScorer(r, squadById);
    return top && { id: top.player.id, points: top.points };
  })(),
  { id: "f1", points: 4 }
);
check(
  "an auto-subbed bench player can be top scorer once they count",
  (() => {
    // f1 blanks with 0 minutes. The engine substitutes by bench priority, not
    // by matching position, so d5 (first outfield sub) comes on — a 5-defender
    // formation is still legal — and their points now count.
    const r = resolveLineup(
      lineup({ f1: { points: 0, minutes: 0 }, d5: { points: 11 } }),
      SETTINGS
    );
    const top = topScorer(r, squadById);
    return top && { id: top.player.id, points: top.points };
  })(),
  { id: "d5", points: 11 }
);

console.log("\n-- unavailable squad members --");
check(
  "injured and suspended both count, available does not",
  unavailablePlayers([
    player({ id: "a" }),
    player({ id: "b", status: "injured" }),
    player({ id: "c", status: "suspended" }),
    player({ id: "d", status: "unavailable" }),
  ]).map((p) => p.id),
  ["b", "c", "d"]
);

console.log(
  failures === 0 ? "\nAll dashboard checks pass." : `\n${failures} FAILED`
);
process.exitCode = failures === 0 ? 0 : 1;
