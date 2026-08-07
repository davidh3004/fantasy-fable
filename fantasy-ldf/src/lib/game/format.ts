/** Prices/budgets are integers in tenths: 1000 = 100.0 */
export function formatMoney(tenths: number): string {
  return `$${(tenths / 10).toFixed(1)}`;
}

/** League-local time (Dominican Republic, AST year-round). */
const LEAGUE_TIME_ZONE = "America/Santo_Domingo";

/** Calendar date in league-local time, as "YYYY-MM-DD". */
function leagueDateKey(date: Date): string {
  // en-CA formats as ISO, which sorts and compares as a plain string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Whole days from `now` to `date`, counted by league-local calendar date:
 * 0 = today, 1 = tomorrow, negative = past.
 *
 * Compared as calendar dates rather than by subtracting timestamps, so a
 * 9pm kickoff is still "today" at 11pm and doesn't roll over early because
 * UTC has already ticked past midnight.
 */
export function leagueDayOffset(date: Date, now: Date = new Date()): number {
  const a = Date.parse(`${leagueDateKey(now)}T00:00:00Z`);
  const b = Date.parse(`${leagueDateKey(date)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatKickoff(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: LEAGUE_TIME_ZONE,
  }).format(date);
}

/** Value for <input type="datetime-local"> in Dominican time (UTC-4). */
export function toAstInputValue(date: Date): string {
  return new Date(date.getTime() - 4 * 3_600_000).toISOString().slice(0, 16);
}

export function formatDeadline(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: LEAGUE_TIME_ZONE,
  }).format(date);
}
