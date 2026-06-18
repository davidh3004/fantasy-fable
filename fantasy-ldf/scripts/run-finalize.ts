/** Dev: runs the real finalize engine on gameweek 1 (same code as the admin button). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

async function main() {
  const sqlc = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const [gw1] = await sqlc`select id, status from gameweeks where number = 1`;
  await sqlc.end();
  if (!gw1) throw new Error("no gameweek 1");

  const { runFinalizeGameweek } = await import("../src/lib/game/finalize");
  const result = await runFinalizeGameweek(gw1.id);
  console.log("finalize result:", JSON.stringify(result));
  process.exit(result.error ? 1 : 0);
}

main();
