/**
 * Dev helper — wipe a user's fantasy data so you can run onboarding again,
 * or fully purge the account.
 *
 *   npx tsx scripts/delete-test-user.ts
 *       → default test user (test-user@example.com), keeps the login.
 *   npx tsx scripts/delete-test-user.ts you@example.com
 *       → a specific email, keeps the login.
 *   npx tsx scripts/delete-test-user.ts you@example.com --purge
 *       → also deletes the auth account (profile + auth.users).
 *
 * Keep the login (default): next sign-in lands on /onboarding (no team yet).
 * Purge: the account is fully removed — register again to recreate it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const EMAIL =
  process.argv.slice(2).find((a) => a.includes("@")) ?? "test-user@example.com";
const PURGE = process.argv.includes("--purge");

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [user] = await sql`select id from auth.users where email = ${EMAIL}`;
  if (!user) {
    console.log(`No auth user for ${EMAIL}. Nothing to do.`);
    await sql.end();
    return;
  }
  const userId = user.id;

  // Fantasy data (children first — the schema has no ON DELETE CASCADE).
  const teams = await sql`select id from fantasy_teams where user_id = ${userId}`;
  for (const team of teams) {
    await sql`delete from lineup_picks where lineup_id in (select id from gameweek_lineups where fantasy_team_id = ${team.id})`;
    await sql`delete from gameweek_lineups where fantasy_team_id = ${team.id}`;
    await sql`delete from squad_picks where fantasy_team_id = ${team.id}`;
    await sql`delete from transfers where fantasy_team_id = ${team.id}`;
    await sql`delete from chip_plays where fantasy_team_id = ${team.id}`;
    await sql`delete from mini_league_members where fantasy_team_id = ${team.id}`;
    await sql`delete from fantasy_teams where id = ${team.id}`;
  }
  console.log(`Cleared ${teams.length} fantasy team(s) for ${EMAIL}.`);

  if (PURGE) {
    // Mini-leagues this user owns (members first, then the league).
    const owned = await sql`select id from mini_leagues where owner_id = ${userId}`;
    for (const league of owned) {
      await sql`delete from mini_league_members where league_id = ${league.id}`;
      await sql`delete from mini_leagues where id = ${league.id}`;
    }
    await sql`delete from profiles where id = ${userId}`;
    await sql`delete from auth.identities where user_id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
    console.log(`Purged account ${EMAIL}. Register again to recreate it.`);
  } else {
    console.log(`Login kept — sign in and you'll land on /onboarding.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
});
