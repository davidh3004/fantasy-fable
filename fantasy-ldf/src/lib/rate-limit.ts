import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * It has to be in the database: the app runs as serverless functions, where
 * each instance has its own memory and its own copy of any in-process counter,
 * so a local Map would let an attacker spread attempts across instances and
 * limit nothing.
 *
 * One statement does the whole thing — insert the first hit, or bump the
 * counter, resetting it when the previous window has expired. Doing it in a
 * single atomic upsert means two concurrent requests cannot both read a stale
 * count and each decide they are under the limit.
 */
export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the current window expires. 0 when allowed. */
  retryAfter: number;
};

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const rows = await db.execute<{ count: number; age_seconds: number }>(sql`
      insert into rate_limits (key, count, window_start)
      values (${key}, 1, now())
      on conflict (key) do update
        set count = case
              when rate_limits.window_start
                   < now() - make_interval(secs => ${windowSeconds})
              then 1
              else rate_limits.count + 1
            end,
            window_start = case
              when rate_limits.window_start
                   < now() - make_interval(secs => ${windowSeconds})
              then now()
              else rate_limits.window_start
            end
      returning count, extract(epoch from now() - window_start)::int as age_seconds
    `);

    const row = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
    const record = row as { count: number; age_seconds: number } | undefined;
    if (!record) return { allowed: true, retryAfter: 0 };

    const allowed = record.count <= limit;
    return {
      allowed,
      retryAfter: allowed
        ? 0
        : Math.max(1, windowSeconds - (record.age_seconds ?? 0)),
    };
  } catch (err) {
    // Fail open. A limiter that takes the feature down when its own table is
    // missing or the database hiccups is worse than the abuse it prevents;
    // the counter is a guard rail, not an authorization check.
    Sentry.captureException(err, { tags: { area: "rate-limit" } });
    console.error("rate limit check failed, allowing request:", err);
    return { allowed: true, retryAfter: 0 };
  }
}
