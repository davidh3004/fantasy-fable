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
  type LineupPickLike,
  type PlayerStat,
} from "../src/lib/game/dashboard";
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

const pick = (
  playerId: string,
  slot: number,
  isCaptain = false
): LineupPickLike => ({ playerId, slot, isCaptain });

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
const xi = Array.from({ length: 11 }, (_, i) => pick(`p${i + 1}`, i + 1));
const withBench = [...xi, pick("b1", 12), pick("b2", 13)];
check(
  "counts only starters with minutes",
  playersPlayed(
    withBench,
    stats({ p1: { points: 5, minutes: 90 }, p2: { points: 2, minutes: 30 } }),
    11
  ),
  { played: 2, total: 11 }
);
check(
  "a bench player's minutes do not inflate the count",
  playersPlayed(withBench, stats({ b1: { points: 9, minutes: 90 } }), 11),
  { played: 0, total: 11 }
);
check(
  "zero minutes is not 'played'",
  playersPlayed(xi, stats({ p1: { points: 0, minutes: 0 } }), 11),
  { played: 0, total: 11 }
);
check(
  "no lineup falls back to the configured XI size",
  playersPlayed([], stats({}), 11),
  { played: 0, total: 11 }
);

// ---------------------------------------------------------------------------
console.log("\n-- captain --");
const capPicks = [pick("p1", 1, true), pick("p2", 2)];
check(
  "captain who hasn't played is flagged",
  captainNotPlayed(capPicks, stats({ p2: { points: 6, minutes: 90 } })),
  "p1"
);
check(
  "captain who played is not flagged",
  captainNotPlayed(capPicks, stats({ p1: { points: 6, minutes: 12 } })),
  null
);
check("no captain, nothing to flag", captainNotPlayed([pick("p1", 1)], stats({})), null);

// ---------------------------------------------------------------------------
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
const squad = [player({ id: "p1" }), player({ id: "p2" }), player({ id: "p3" })];
check(
  "captain doubling can win the top spot",
  topScorer(
    squad,
    [pick("p1", 1, true), pick("p2", 2)],
    stats({ p1: { points: 6, minutes: 90 }, p2: { points: 9, minutes: 90 } })
  ),
  { player: player({ id: "p1" }), points: 12, isCaptain: true }
);
check(
  "a player who didn't feature is never top scorer",
  topScorer(
    squad,
    [pick("p1", 1)],
    stats({ p1: { points: 0, minutes: 0 }, p2: { points: 3, minutes: 45 } })
  ),
  { player: player({ id: "p2" }), points: 3, isCaptain: false }
);
check("nobody played → null", topScorer(squad, [], stats({})), null);

// ---------------------------------------------------------------------------
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
