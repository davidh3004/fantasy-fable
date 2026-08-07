/**
 * Puts the active season into a *live* state so the live UI can be clicked
 * through: gameweek deadline in the past, the first fixture kicked off 30
 * minutes ago (so it derives as live), the rest still scheduled.
 *
 * Run: npx tsx scripts/simulate-live-gw.ts [gameweekNumber]
 * Undo with: npx tsx scripts/reset-gw.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const GW_NUMBER = Number(process.argv[2]) || 1;

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [season] = await sql`select id from seasons where is_active = true`;
  if (!season) throw new Error("No active season");

  const [gameweek] = await sql`
    select id, number from gameweeks
    where season_id = ${season.id} and number = ${GW_NUMBER}
  `;
  if (!gameweek) throw new Error(`Gameweek ${GW_NUMBER} not found`);

  // Deadline in the past -> the gameweek derives as in play.
  await sql`
    update gameweeks
    set deadline = now() - interval '2 hours', status = 'upcoming'
    where id = ${gameweek.id}
  `;

  const fixtures = await sql`
    select id from fixtures where gameweek_id = ${gameweek.id} order by kickoff
  `;
  if (fixtures.length === 0) throw new Error("Gameweek has no fixtures");

  // First fixture kicked off 30 minutes ago; the others are still to come.
  await sql`
    update fixtures
    set kickoff = now() - interval '30 minutes', status = 'scheduled',
        home_score = null, away_score = null
    where id = ${fixtures[0].id}
  `;
  for (const fixture of fixtures.slice(1)) {
    await sql`
      update fixtures
      set kickoff = now() + interval '1 day', status = 'scheduled',
          home_score = null, away_score = null
      where id = ${fixture.id}
    `;
  }
  await sql`delete from player_match_stats where fixture_id in ${sql(
    fixtures.map((f) => f.id)
  )}`;

  console.log(
    `Gameweek ${gameweek.number} is now live:\n` +
      `  - deadline 2h ago (gameweek reads "in play")\n` +
      `  - fixture 1 kicked off 30 min ago (reads LIVE, gold cards)\n` +
      `  - ${fixtures.length - 1} fixture(s) tomorrow\n` +
      `  - match stats cleared\n\n` +
      `Open /team, then /admin/results to run the live console.`
  );

  await sql.end();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
});
