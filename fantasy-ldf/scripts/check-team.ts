import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const [team] = await sql`
    select ft.id, ft.name, ft.budget, ft.free_transfers, p.display_name, p.favorite_club_id is not null as has_fav
    from fantasy_teams ft join profiles p on p.id = ft.user_id
    where p.display_name = 'Tester'
  `;
  console.log("team:", JSON.stringify(team));

  const [picks] = await sql`
    select count(*)::int as picks, sum(purchase_price)::int as cost
    from squad_picks where fantasy_team_id = ${team.id}
  `;
  console.log("squad:", JSON.stringify(picks));

  const positions = await sql`
    select pl.position, count(*)::int as n
    from squad_picks sp join players pl on pl.id = sp.player_id
    where sp.fantasy_team_id = ${team.id}
    group by pl.position order by pl.position
  `;
  console.log("positions:", JSON.stringify(positions));

  const lineup = await sql`
    select gl.id, gw.number as gw,
      count(lp.id)::int as slots,
      count(*) filter (where lp.is_captain)::int as captains,
      count(*) filter (where lp.is_vice)::int as vices,
      count(*) filter (where lp.slot <= 11)::int as starters
    from gameweek_lineups gl
    join gameweeks gw on gw.id = gl.gameweek_id
    join lineup_picks lp on lp.lineup_id = gl.id
    where gl.fantasy_team_id = ${team.id}
    group by gl.id, gw.number
  `;
  console.log("lineup:", JSON.stringify(lineup));

  const slots = await sql`
    select lp.slot, pl.last_name, pl.position, lp.is_captain, lp.is_vice
    from lineup_picks lp
    join gameweek_lineups gl on gl.id = lp.lineup_id
    join players pl on pl.id = lp.player_id
    where gl.fantasy_team_id = ${team.id}
    order by lp.slot
  `;
  console.log(
    slots
      .map(
        (r) =>
          `${String(r.slot).padStart(2)} ${r.position.padEnd(3)} ${r.last_name}` +
          `${r.is_captain ? " [C]" : ""}${r.is_vice ? " [V]" : ""}`
      )
      .join("\n")
  );
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
