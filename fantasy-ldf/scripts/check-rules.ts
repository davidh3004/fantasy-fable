import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  if (process.argv[2] === "revert-fwd-goal") {
    await sql`update scoring_rules set points = 4 where event_key = 'goal' and position = 'FWD'`;
  }
  const rows =
    await sql`select event_key, position, points from scoring_rules where event_key = 'goal' order by position`;
  console.log(JSON.stringify(rows));
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
