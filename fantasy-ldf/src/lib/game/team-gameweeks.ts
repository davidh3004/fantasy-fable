/**
 * Which gameweeks the team page can show, and which one it opens on.
 *
 * The range is the *season's* gameweeks, not the ones this team happens to
 * have a lineup row for. Onboarding only ever creates a row for the gameweek
 * that was upcoming at signup, so scoping the range to a team's own rows made
 * every earlier gameweek unreachable — the nav arrows had nowhere to go.
 */

import { effectiveGameweekStatus } from "./status";
import type { TeamGameweek } from "./queries";

/**
 * Every gameweek that has already started, plus the upcoming editable one.
 *
 * Future gameweeks past the next one are left out: there's no lineup, no
 * points and no result to look at yet.
 */
export function buildViewableGameweeks(
  all: TeamGameweek[],
  nextGameweek: TeamGameweek | null,
  now: Date = new Date()
): TeamGameweek[] {
  const viewable = all.filter(
    (gw) =>
      effectiveGameweekStatus(gw, now) !== "upcoming" ||
      gw.id === nextGameweek?.id
  );

  // A brand-new season may have no started gameweeks yet, and the upcoming one
  // isn't guaranteed to be in `all` if it belongs to another season.
  if (nextGameweek && !viewable.some((gw) => gw.id === nextGameweek.id)) {
    viewable.push(nextGameweek);
  }

  return viewable.sort((a, b) => a.number - b.number);
}

/**
 * The gameweek to open on, in priority order:
 *   1. the one in play (deadline passed, not finalized)
 *   2. the upcoming editable one
 *   3. the most recent one available
 *
 * Without (1) a live gameweek is skipped the moment the next one is
 * scheduled, hiding the squad that's actually scoring right now.
 */
export function pickDefaultGameweek(
  viewable: TeamGameweek[],
  nextGameweek: TeamGameweek | null,
  now: Date = new Date()
): TeamGameweek | null {
  const live = viewable
    .filter((gw) => effectiveGameweekStatus(gw, now) === "locked")
    .at(-1);
  if (live) return live;

  const upcoming = nextGameweek
    ? viewable.find((gw) => gw.id === nextGameweek.id)
    : undefined;
  return upcoming ?? viewable.at(-1) ?? null;
}
