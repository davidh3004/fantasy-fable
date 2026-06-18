/**
 * Dev helper: simulates a played gameweek 1 so the finalize engine can run.
 * - moves the GW1 deadline into the past
 * - creates GW2 (deadline +7d) if missing, for the lineup rollover
 * - generates realistic stats for every GW1 fixture (points via scoring lib)
 * - forces an auto-sub case on the Tester team (one starter with 0 minutes)
 *
 * Undo with: npx tsx scripts/reset-gw.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";
import { buildRuleLookup, computePoints } from "../src/lib/game/scoring";
import type { Position } from "../src/lib/game/squad";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

const rand = (n: number) => Math.floor(Math.random() * n);

async function main() {
  const [gw1] = await sql`select * from gameweeks where number = 1`;
  if (!gw1) throw new Error("no gameweek 1");

  await sql`update gameweeks set deadline = now() - interval '1 hour' where id = ${gw1.id}`;

  const [gw2] = await sql`select id from gameweeks where number = 2`;
  if (!gw2) {
    await sql`
      insert into gameweeks (season_id, number, deadline, status)
      values (${gw1.season_id}, 2, now() + interval '7 days', 'upcoming')
    `;
    console.log("created gameweek 2 (deadline +7d)");
  }

  const ruleRows = await sql`
    select event_key as "eventKey", position, points from scoring_rules
    where season_id = ${gw1.season_id}
  `;
  const rule = buildRuleLookup(
    ruleRows.map((r) => ({
      eventKey: r.eventKey,
      position: r.position as Position | null,
      points: r.points,
    }))
  );

  const fixtures =
    await sql`select * from fixtures where gameweek_id = ${gw1.id}`;

  for (const fixture of fixtures) {
    const homeScore = rand(4);
    const awayScore = rand(3);
    await sql`delete from player_match_stats where fixture_id = ${fixture.id}`;

    for (const [clubId, scored, conceded] of [
      [fixture.home_club_id, homeScore, awayScore],
      [fixture.away_club_id, awayScore, homeScore],
    ] as const) {
      const clubPlayers = await sql`
        select id, position from players where club_id = ${clubId}
      `;
      const gks = clubPlayers.filter((p) => p.position === "GK");
      const outfield = clubPlayers.filter((p) => p.position !== "GK");

      // 1 GK + 10 outfield start; 3 more get sub minutes.
      const starters = [gks[0], ...outfield.slice(0, 10)];
      const subs = outfield.slice(10, 13);
      const lines = [
        ...starters.map((p) => ({ player: p, minutes: 90 })),
        ...subs.map((p) => ({ player: p, minutes: 15 + rand(30) })),
      ];

      // Distribute goals/assists among non-GK participants.
      const goals = new Map<string, number>();
      const assists = new Map<string, number>();
      const eligible = lines.filter((l) => l.player.position !== "GK");
      for (let i = 0; i < scored; i++) {
        const scorer = eligible[rand(eligible.length)].player.id;
        goals.set(scorer, (goals.get(scorer) ?? 0) + 1);
        if (Math.random() > 0.3) {
          const assister = eligible[rand(eligible.length)].player.id;
          if (assister !== scorer) {
            assists.set(assister, (assists.get(assister) ?? 0) + 1);
          }
        }
      }

      for (const line of lines) {
        const stat = {
          minutes: line.minutes,
          goals: goals.get(line.player.id) ?? 0,
          assists: assists.get(line.player.id) ?? 0,
          cleanSheet: conceded === 0 && line.minutes >= 60,
          saves: line.player.position === "GK" ? rand(7) : 0,
          penaltiesSaved: 0,
          penaltiesMissed: 0,
          goalsConceded: conceded,
          yellowCards: Math.random() > 0.85 ? 1 : 0,
          redCards: 0,
          ownGoals: 0,
          bonusPoints: 0,
        };
        const points = computePoints(
          stat,
          line.player.position as Position,
          rule
        );
        await sql`
          insert into player_match_stats ${sql({
            fixture_id: fixture.id,
            player_id: line.player.id,
            minutes: stat.minutes,
            goals: stat.goals,
            assists: stat.assists,
            clean_sheet: stat.cleanSheet,
            saves: stat.saves,
            penalties_saved: 0,
            penalties_missed: 0,
            goals_conceded: stat.goalsConceded,
            yellow_cards: stat.yellowCards,
            red_cards: stat.redCards,
            own_goals: stat.ownGoals,
            bonus_points: 0,
            points,
          })}
        `;
      }
    }

    await sql`
      update fixtures set home_score = ${homeScore}, away_score = ${awayScore},
        status = 'finished' where id = ${fixture.id}
    `;
    console.log(`fixture done: ${homeScore}-${awayScore}`);
  }

  // Force an auto-sub case for Tester: zero out an outfield starter,
  // make sure the first outfield bench player has minutes.
  const testerPicks = await sql`
    select lp.id, lp.player_id, lp.slot, p.position
    from lineup_picks lp
    join gameweek_lineups gl on gl.id = lp.lineup_id and gl.gameweek_id = ${gw1.id}
    join fantasy_teams ft on ft.id = gl.fantasy_team_id
    join profiles pr on pr.id = ft.user_id
    join players p on p.id = lp.player_id
    where pr.display_name = 'Tester'
    order by lp.slot
  `;
  if (testerPicks.length === 15) {
    const victim = [...testerPicks]
      .reverse()
      .find((p) => p.slot <= 11 && p.position !== "GK")!;
    await sql`
      update player_match_stats set minutes = 0, goals = 0, assists = 0,
        clean_sheet = false, points = 0
      where player_id = ${victim.player_id}
        and fixture_id in (select id from fixtures where gameweek_id = ${gw1.id})
    `;
    const firstBenchOut = testerPicks.find((p) => p.slot === 13)!;
    await sql`
      update player_match_stats set minutes = greatest(minutes, 60),
        points = greatest(points, 2)
      where player_id = ${firstBenchOut.player_id}
        and fixture_id in (select id from fixtures where gameweek_id = ${gw1.id})
    `;
    console.log(
      `auto-sub case: starter slot ${victim.slot} zeroed; bench slot 13 plays`
    );
  }

  console.log("simulation ready — finalize GW1 from the admin panel");
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
