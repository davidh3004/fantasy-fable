/** Undoes simulate-gw.ts + finalization: restores GW1 to pristine pre-deadline state. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const [gw1] = await sql`select * from gameweeks where number = 1`;
  if (!gw1) throw new Error("no gameweek 1");

  // Clear stats + fixture results
  await sql`delete from player_match_stats where fixture_id in (select id from fixtures where gameweek_id = ${gw1.id})`;
  await sql`update fixtures set home_score = null, away_score = null, status = 'scheduled' where gameweek_id = ${gw1.id}`;

  // Restore deadline = first kickoff − 90 min, status upcoming
  await sql`
    update gameweeks set status = 'upcoming', finalized_at = null,
      deadline = (select min(kickoff) from fixtures where gameweek_id = ${gw1.id}) - interval '90 minutes'
    where id = ${gw1.id}
  `;

  // Clear lineup points for GW1
  await sql`
    update lineup_picks set points = null
    where lineup_id in (select id from gameweek_lineups where gameweek_id = ${gw1.id})
  `;
  await sql`update gameweek_lineups set points = null where gameweek_id = ${gw1.id}`;

  // Remove the rolled-over GW2 lineups + the simulated GW2 itself (if empty of fixtures)
  const [gw2] = await sql`select id from gameweeks where number = 2`;
  if (gw2) {
    await sql`delete from lineup_picks where lineup_id in (select id from gameweek_lineups where gameweek_id = ${gw2.id})`;
    await sql`delete from gameweek_lineups where gameweek_id = ${gw2.id}`;
    const [{ n }] =
      await sql`select count(*)::int as n from fixtures where gameweek_id = ${gw2.id}`;
    if (n === 0) {
      await sql`delete from gameweeks where id = ${gw2.id}`;
      console.log("removed simulated gameweek 2");
    }
  }

  // Reset team aggregates
  await sql`update fantasy_teams set total_points = 0, overall_rank = null, free_transfers = 1`;

  console.log("gameweek 1 restored to pre-deadline state");
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
