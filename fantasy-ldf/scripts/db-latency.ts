import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });

async function timed(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now();
  await fn();
  console.log(`${label}: ${Math.round(performance.now() - t0)}ms`);
}

async function main() {
  await timed("cold select 1 (incl. connect)", () => sql`select 1`);
  await timed("warm select 1", () => sql`select 1`);
  await timed("warm select 1", () => sql`select 1`);
  await timed("4x select parallel (warm pool?)", () =>
    Promise.all([
      sql`select count(*) from fantasy_teams`,
      sql`select count(*) from gameweeks`,
      sql`select count(*) from fixtures`,
      sql`select count(*) from players`,
    ])
  );
  await timed("4x select parallel again", () =>
    Promise.all([
      sql`select count(*) from fantasy_teams`,
      sql`select count(*) from gameweeks`,
      sql`select count(*) from fixtures`,
      sql`select count(*) from players`,
    ])
  );
}

main().finally(() => sql.end());
