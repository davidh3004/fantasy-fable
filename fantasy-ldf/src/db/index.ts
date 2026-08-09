// Fails the build loudly if this module is ever pulled into a client bundle —
// DATABASE_URL holds the pooler password and must never reach the browser.
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * prepare: false — required by Supabase's transaction pooler.
 *
 * max: 2 — this is a per-process ceiling, and in serverless every concurrent
 * instance is another process holding its own pool against the pooler's client
 * cap. Five each meant a few dozen warm instances could exhaust it; two lets
 * more than twice as many run before anyone is refused a connection. Requests
 * here are short, so a third concurrent query on one instance waits
 * microseconds rather than failing.
 *
 * The client is cached on globalThis so dev hot-reload doesn't leak pools.
 */
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, { prepare: false, max: 2 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
