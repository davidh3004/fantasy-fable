import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const rows = await sql`
    select id, email, email_confirmed_at is not null as confirmed
    from auth.users where email = 'test-user@example.com'
  `;
  console.log(rows.length ? JSON.stringify(rows[0]) : "NOT FOUND");
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
