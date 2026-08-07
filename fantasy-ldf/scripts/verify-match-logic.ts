/**
 * Pure-logic checks for the live match console: minutes derivation and the
 * derived fixture/gameweek statuses. No database needed.
 *
 * Run: npx tsx scripts/verify-match-logic.ts
 */
import {
  FULL_TIME_MINUTE,
  elapsedMinute,
  isOnPitch,
  minutesPlayed,
} from "../src/lib/game/match-clock";
import {
  effectiveFixtureStatus,
  effectiveGameweekStatus,
} from "../src/lib/game/status";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `  → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
  );
}

const NOW = new Date("2026-08-05T18:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const minutesAhead = (m: number) => new Date(NOW.getTime() + m * 60_000);

console.log("\n-- minutes played --");
const starter = { started: true, onMinute: 0, offMinute: null };
check("starter, 30' in", minutesPlayed(starter, 30), 30);
check("starter, full time", minutesPlayed(starter, FULL_TIME_MINUTE), 90);
check(
  "starter subbed at 60, clock 75",
  minutesPlayed({ started: true, onMinute: 0, offMinute: 60 }, 75),
  60
);
check(
  "sub on at 70, clock 90",
  minutesPlayed({ started: false, onMinute: 70, offMinute: null }, 90),
  20
);
check(
  "sub on 70 off 80, clock 90",
  minutesPlayed({ started: false, onMinute: 70, offMinute: 80 }, 90),
  10
);
check(
  "unused sub",
  minutesPlayed({ started: false, onMinute: null, offMinute: null }, 90),
  0
);
check(
  "sub not on yet (clock before entry)",
  minutesPlayed({ started: false, onMinute: 70, offMinute: null }, 60),
  0
);

console.log("\n-- on pitch --");
check("starter is on", isOnPitch(starter, 30), true);
check(
  "subbed-off starter is off",
  isOnPitch({ started: true, onMinute: 0, offMinute: 60 }, 75),
  false
);
check(
  "sub not on until their minute",
  isOnPitch({ started: false, onMinute: 70, offMinute: null }, 60),
  false
);
check(
  "sub on after their minute",
  isOnPitch({ started: false, onMinute: 70, offMinute: null }, 75),
  true
);
check(
  "unused sub is off",
  isOnPitch({ started: false, onMinute: null, offMinute: null }, 90),
  false
);

console.log("\n-- elapsed clock --");
check("30 min after kickoff", elapsedMinute(minutesAgo(30), NOW), 30);
check("before kickoff clamps to 0", elapsedMinute(minutesAhead(10), NOW), 0);
check("caps at full time", elapsedMinute(minutesAgo(200), NOW), FULL_TIME_MINUTE);

console.log("\n-- fixture status --");
check(
  "kicked off -> live",
  effectiveFixtureStatus({ status: "scheduled", kickoff: minutesAgo(10) }, NOW),
  "live"
);
check(
  "not kicked off -> scheduled",
  effectiveFixtureStatus({ status: "scheduled", kickoff: minutesAhead(10) }, NOW),
  "scheduled"
);
check(
  "finished stays finished",
  effectiveFixtureStatus({ status: "finished", kickoff: minutesAgo(200) }, NOW),
  "finished"
);
check(
  "explicit live wins before kickoff",
  effectiveFixtureStatus({ status: "live", kickoff: minutesAhead(30) }, NOW),
  "live"
);

console.log("\n-- gameweek status --");
check(
  "deadline passed -> locked",
  effectiveGameweekStatus({ status: "upcoming", deadline: minutesAgo(5) }, NOW),
  "locked"
);
check(
  "deadline ahead -> upcoming",
  effectiveGameweekStatus({ status: "upcoming", deadline: minutesAhead(5) }, NOW),
  "upcoming"
);
check(
  "finalized stays finished",
  effectiveGameweekStatus({ status: "finished", deadline: minutesAgo(500) }, NOW),
  "finished"
);

console.log(
  failures === 0 ? "\nAll match logic checks pass." : `\n${failures} FAILED`
);
process.exitCode = failures === 0 ? 0 : 1;
