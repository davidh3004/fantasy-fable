/** Prints the full post-finalize state for manual verification. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const teams = await sql`
    select ft.name, ft.total_points, ft.overall_rank, ft.free_transfers
    from fantasy_teams ft order by ft.overall_rank
  `;
  console.log("TEAMS:");
  for (const t of teams) {
    console.log(
      `  #${t.overall_rank} ${t.name} — ${t.total_points} pts, FT=${t.free_transfers}`
    );
  }

  const [gw1] = await sql`select * from gameweeks where number = 1`;
  console.log(`\nGW1: status=${gw1.status} finalized=${gw1.finalized_at != null}`);

  const lineup = await sql`
    select lp.slot, p.last_name, p.position, lp.is_captain, lp.is_vice,
      lp.points as pick_points,
      coalesce((select sum(s.points)::int from player_match_stats s
        join fixtures f on f.id = s.fixture_id
        where s.player_id = lp.player_id and f.gameweek_id = ${gw1.id}), 0) as raw,
      coalesce((select sum(s.minutes)::int from player_match_stats s
        join fixtures f on f.id = s.fixture_id
        where s.player_id = lp.player_id and f.gameweek_id = ${gw1.id}), 0) as mins
    from lineup_picks lp
    join gameweek_lineups gl on gl.id = lp.lineup_id and gl.gameweek_id = ${gw1.id}
    join fantasy_teams ft on ft.id = gl.fantasy_team_id
    join profiles pr on pr.id = ft.user_id
    join players p on p.id = lp.player_id
    where pr.display_name = 'Tester'
    order by lp.slot
  `;
  console.log("\nTESTER GW1 LINEUP (slot, player, raw pts, mins → counted pts):");
  for (const r of lineup) {
    const tag = r.is_captain ? " [C]" : r.is_vice ? " [V]" : "";
    console.log(
      `  ${String(r.slot).padStart(2)} ${r.position.padEnd(3)} ${r.last_name}${tag}` +
        ` raw=${r.raw} min=${r.mins} → ${r.pick_points}`
    );
  }

  const [gl] = await sql`
    select gl.points, gl.transfers_cost from gameweek_lineups gl
    join fantasy_teams ft on ft.id = gl.fantasy_team_id
    join profiles pr on pr.id = ft.user_id
    where pr.display_name = 'Tester' and gl.gameweek_id = ${gw1.id}
  `;
  console.log(`\nTester GW1 total: ${gl.points} (transfer cost ${gl.transfers_cost})`);

  const [gw2] = await sql`select id from gameweeks where number = 2`;
  if (gw2) {
    const [{ n }] = await sql`
      select count(*)::int as n from gameweek_lineups where gameweek_id = ${gw2.id}
    `;
    console.log(`GW2 rolled-over lineups: ${n}`);
  }
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
