import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const rows = await sql`
    select p.last_name, p.position, s.minutes, s.goals, s.clean_sheet,
           s.goals_conceded, s.bonus_points, s.points,
           f.home_score, f.away_score, f.status
    from player_match_stats s
    join players p on p.id = s.player_id
    join fixtures f on f.id = s.fixture_id
    order by s.points desc
  `;
  for (const r of rows) {
    console.log(
      `${r.last_name} (${r.position}) min=${r.minutes} goals=${r.goals} ` +
        `cs=${r.clean_sheet} conceded=${r.goals_conceded} bonus=${r.bonus_points} ` +
        `→ ${r.points} pts | fixture ${r.home_score}-${r.away_score} ${r.status}`
    );
  }
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
