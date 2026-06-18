/** Grants admin to known dev accounts (profile must exist = onboarded). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const ADMIN_EMAILS = ["henriquezdavid3004@gmail.com", "test-user@example.com"];

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const rows = await sql`
    update profiles set is_admin = true
    where id in (select id from auth.users where email in ${sql(ADMIN_EMAILS)})
    returning display_name
  `;
  console.log(
    "admins:",
    rows.map((r) => r.display_name).join(", ") || "(none — onboard first)"
  );
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
