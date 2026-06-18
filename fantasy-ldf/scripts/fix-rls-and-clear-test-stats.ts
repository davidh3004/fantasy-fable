import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const TABLES = [
  "profiles", "competitions", "seasons", "clubs", "players", "gameweeks",
  "fixtures", "player_match_stats", "scoring_rules", "game_settings",
  "fantasy_teams", "squad_picks", "gameweek_lineups", "lineup_picks",
  "transfers", "chip_plays", "mini_leagues", "mini_league_members",
];

async function main() {
  await sql`delete from player_match_stats`;
  await sql`update fixtures set home_score = null, away_score = null, status = 'scheduled' where status = 'finished'`;
  console.log("test stats cleared");

  for (const table of TABLES) {
    await sql.unsafe(`alter table "${table}" enable row level security`);
  }
  const off = await sql`select tablename from pg_tables where schemaname='public' and rowsecurity = false`;
  console.log("tables without RLS:", off.length === 0 ? "(none)" : off.map((r) => r.tablename).join(", "));
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
