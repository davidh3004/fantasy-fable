/**
 * Applies the performance indexes from drizzle/0001_performance_indexes.sql
 * to the live database with CREATE INDEX CONCURRENTLY (no write locks).
 *
 * Run: npm run db:indexes   (or: npx tsx scripts/add-indexes.ts)
 *
 * Uses DIRECT_URL (session pooler) — CONCURRENTLY needs a real session and
 * won't run over the transaction pooler. Idempotent (IF NOT EXISTS).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const STATEMENTS = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS fantasy_teams_season_points_idx ON fantasy_teams (season_id, total_points)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS fixtures_gameweek_idx ON fixtures (gameweek_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS gameweek_lineups_gameweek_idx ON gameweek_lineups (gameweek_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS players_club_idx ON players (club_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS mini_league_members_team_idx ON mini_league_members (fantasy_team_id)`,
];

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");

  // max: 1, no prepared statements, autocommit (no transaction) for CONCURRENTLY.
  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    for (const stmt of STATEMENTS) {
      const name = stmt.match(/EXISTS (\w+)/)?.[1] ?? "index";
      process.stdout.write(`creating ${name} ... `);
      await sql.unsafe(stmt);
      console.log("ok");
    }
    console.log("\nAll performance indexes are in place.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
});
