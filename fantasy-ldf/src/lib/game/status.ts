/**
 * Fixture and gameweek status, derived rather than trusted.
 *
 * The stored columns are only ever moved by an admin, so on their own they
 * drift out of step with reality: a match whose kickoff has passed still reads
 * `scheduled`, and a gameweek past its deadline still reads `upcoming`. Every
 * "is this live?" decision in the app goes through these helpers instead, so
 * the live ribbon, gold cards and live points can't disagree with each other.
 */

export type FixtureStatus = "scheduled" | "live" | "finished";
export type GameweekStatus = "upcoming" | "locked" | "finished";

export type FixtureLike = {
  status: FixtureStatus;
  kickoff: Date;
};

export type GameweekLike = {
  status: GameweekStatus;
  deadline: Date;
};

/**
 * `finished` and an explicit `live` are admin overrides and always win. A
 * `scheduled` fixture becomes live on its own once kickoff passes, so nobody
 * has to remember to flip it. (A postponed match is handled by moving its
 * kickoff, which the admin would do anyway.)
 */
export function effectiveFixtureStatus(
  fixture: FixtureLike,
  now: Date = new Date()
): FixtureStatus {
  if (fixture.status === "finished") return "finished";
  if (fixture.status === "live") return "live";
  return fixture.kickoff <= now ? "live" : "scheduled";
}

export function isFixtureLive(fixture: FixtureLike, now?: Date): boolean {
  return effectiveFixtureStatus(fixture, now) === "live";
}

/**
 * A gameweek is finished only when the finalize engine says so — that's the
 * flag the points snapshot depends on. Before that it's in play from the
 * moment its deadline passes.
 */
export function effectiveGameweekStatus(
  gameweek: GameweekLike,
  now: Date = new Date()
): GameweekStatus {
  if (gameweek.status === "finished") return "finished";
  return gameweek.deadline <= now ? "locked" : "upcoming";
}

export function isGameweekLive(gameweek: GameweekLike, now?: Date): boolean {
  return effectiveGameweekStatus(gameweek, now) === "locked";
}
