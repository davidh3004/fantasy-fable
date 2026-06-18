/** Deletes the Tester user's fantasy team (dev helper to re-run onboarding). */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const teams = await sql`
    select ft.id from fantasy_teams ft
    join profiles p on p.id = ft.user_id
    where p.display_name = 'Tester'
  `;
  for (const team of teams) {
    await sql`delete from lineup_picks where lineup_id in (select id from gameweek_lineups where fantasy_team_id = ${team.id})`;
    await sql`delete from gameweek_lineups where fantasy_team_id = ${team.id}`;
    await sql`delete from squad_picks where fantasy_team_id = ${team.id}`;
    await sql`delete from transfers where fantasy_team_id = ${team.id}`;
    await sql`delete from chip_plays where fantasy_team_id = ${team.id}`;
    await sql`delete from mini_league_members where fantasy_team_id = ${team.id}`;
    await sql`delete from fantasy_teams where id = ${team.id}`;
  }
  console.log(`Deleted ${teams.length} test team(s).`);
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
