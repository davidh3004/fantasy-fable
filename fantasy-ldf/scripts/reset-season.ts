/**
 * Rewinds the active season to the moment before its first deadline.
 *
 * What it clears: every match result and player stat line, every gameweek's
 * finalized state, all banked points, transfer history and chips played.
 *
 * What it keeps: the calendar (gameweeks and fixtures with their dates), and
 * every manager's team, squad and saved lineups — so nobody has to re-onboard
 * and the schedule you set up survives. The bank is recomputed from what each
 * squad actually cost, so it lines up with the players still held.
 *
 * Destructive and irreversible. Requires --yes, and refuses to touch a
 * database whose URL doesn't look like a dev one unless --force is given too.
 *
 *   npx tsx scripts/reset-season.ts --yes
 *   npx tsx scripts/reset-season.ts --yes --force   # non-dev database
 *   npx tsx scripts/reset-season.ts --dry-run       # count only, no writes
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  chipPlays,
  fantasyTeams,
  fixtures,
  gameSettings,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  seasons,
  squadPicks,
  transfers,
} from "../src/db/schema";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const confirmed = args.has("--yes");
const force = args.has("--force");

/** Rough guard: production URLs shouldn't be reset by a one-liner. */
function looksLikeDevDatabase(url: string): boolean {
  return /localhost|127\.0\.0\.1|-dev|dev-|staging|test/i.test(url);
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("No DATABASE_URL/DIRECT_URL. Is .env.local present?");
    process.exit(1);
  }

  if (!dryRun && !confirmed) {
    console.error(
      "Refusing to run without --yes. This deletes every result and point\n" +
        "in the active season. Use --dry-run first to see the damage."
    );
    process.exit(1);
  }
  if (!dryRun && !looksLikeDevDatabase(url) && !force) {
    console.error(
      "This database doesn't look like a dev one. Re-run with --force if you\n" +
        "really mean to reset it."
    );
    process.exit(1);
  }

  const [season] = await db
    .select({ id: seasons.id, name: seasons.name })
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  if (!season) {
    console.error("No active season.");
    process.exit(1);
  }

  const [settings] = await db
    .select({
      budget: gameSettings.budget,
      freeTransfersPerGw: gameSettings.freeTransfersPerGw,
    })
    .from(gameSettings)
    .where(eq(gameSettings.seasonId, season.id))
    .limit(1);
  if (!settings) {
    console.error("Active season has no game settings.");
    process.exit(1);
  }

  const gameweekIds = (
    await db
      .select({ id: gameweeks.id })
      .from(gameweeks)
      .where(eq(gameweeks.seasonId, season.id))
  ).map((g) => g.id);

  const fixtureIds =
    gameweekIds.length > 0
      ? (
          await db
            .select({ id: fixtures.id })
            .from(fixtures)
            .where(inArray(fixtures.gameweekId, gameweekIds))
        ).map((f) => f.id)
      : [];

  const teamIds = (
    await db
      .select({ id: fantasyTeams.id })
      .from(fantasyTeams)
      .where(eq(fantasyTeams.seasonId, season.id))
  ).map((t) => t.id);

  const [statCount] = fixtureIds.length
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(playerMatchStats)
        .where(inArray(playerMatchStats.fixtureId, fixtureIds))
    : [{ n: 0 }];

  const [finishedGws] = gameweekIds.length
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(gameweeks)
        .where(
          and(
            eq(gameweeks.seasonId, season.id),
            eq(gameweeks.status, "finished")
          )
        )
    : [{ n: 0 }];

  console.log(`Season:          ${season.name}`);
  console.log(`Gameweeks:       ${gameweekIds.length} (${finishedGws.n} finalized)`);
  console.log(`Fixtures:        ${fixtureIds.length}`);
  console.log(`Player stat rows:${String(statCount.n).padStart(6)}  → deleted`);
  console.log(`Fantasy teams:   ${teamIds.length}  → points zeroed, squads kept`);

  if (dryRun) {
    console.log("\n--dry-run: nothing was written.");
    return;
  }

  await db.transaction(async (tx) => {
    // 1. Match results and the stat lines scoring reads.
    if (fixtureIds.length > 0) {
      await tx
        .delete(playerMatchStats)
        .where(inArray(playerMatchStats.fixtureId, fixtureIds));

      await tx
        .update(fixtures)
        .set({ status: "scheduled", homeScore: null, awayScore: null })
        .where(inArray(fixtures.id, fixtureIds));
    }

    // 2. Gameweeks back to upcoming. Statuses are derived from the deadline at
    //    read time, so a past deadline still reads as in-play — the calendar
    //    keeps its dates, which is what was asked for.
    if (gameweekIds.length > 0) {
      await tx
        .update(gameweeks)
        .set({ status: "upcoming", finalizedAt: null })
        .where(inArray(gameweeks.id, gameweekIds));
    }

    if (teamIds.length > 0) {
      // 3. Banked points: the per-pick snapshots, then the lineup totals.
      //    Lineups themselves stay, so nobody loses their arrangement.
      const lineupIds = (
        await tx
          .select({ id: gameweekLineups.id })
          .from(gameweekLineups)
          .where(inArray(gameweekLineups.fantasyTeamId, teamIds))
      ).map((l) => l.id);

      if (lineupIds.length > 0) {
        await tx
          .update(lineupPicks)
          .set({ points: null })
          .where(inArray(lineupPicks.lineupId, lineupIds));

        await tx
          .update(gameweekLineups)
          .set({ points: null, transfersCost: 0, chip: null })
          .where(inArray(gameweekLineups.id, lineupIds));
      }

      // 4. Season history: transfers made and chips played.
      await tx
        .delete(transfers)
        .where(inArray(transfers.fantasyTeamId, teamIds));
      await tx
        .delete(chipPlays)
        .where(inArray(chipPlays.fantasyTeamId, teamIds));

      // 5. Team totals. The bank is recomputed from what the squad actually
      //    cost rather than reset flat, so it stays consistent with the
      //    players each team still holds after a season of transfers.
      await tx.execute(sql`
        update fantasy_teams ft
        set total_points = 0,
            overall_rank = null,
            previous_overall_rank = null,
            free_transfers = ${settings.freeTransfersPerGw},
            budget = ${settings.budget} - coalesce((
              select sum(sp.purchase_price)
              from ${squadPicks} sp
              where sp.fantasy_team_id = ft.id
            ), 0)
        where ft.season_id = ${season.id}
      `);
    }
  });

  console.log("\nSeason reset. Results, points and history cleared;");
  console.log("calendar, teams and squads kept.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
