import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
  connect_timeout: 15,
});

async function main() {
  const tables =
    await sql`select tablename from pg_tables where schemaname = 'public' order by tablename`;
  console.log("tables:", tables.map((r) => r.tablename).join(", ") || "(none)");

  if (tables.length > 0) {
    const counts = await sql`
      select
        (select count(*) from clubs) as clubs,
        (select count(*) from players) as players,
        (select count(*) from scoring_rules) as rules,
        (select count(*) from fixtures) as fixtures
    `.catch(() => null);
    if (counts) console.log("counts:", JSON.stringify(counts[0]));
    const rls = await sql`select tablename, rowsecurity from pg_tables where schemaname='public' and rowsecurity = false`;
    console.log("tables WITHOUT rls:", rls.map((r) => r.tablename).join(", ") || "(none)");
  }
}

main()
  .catch((err) => {
    console.error("ERROR:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
