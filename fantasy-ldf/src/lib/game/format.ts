/** Prices/budgets are integers in tenths: 1000 = 100.0 */
export function formatMoney(tenths: number): string {
  return `$${(tenths / 10).toFixed(1)}`;
}

/** League-local time (Dominican Republic, AST year-round). */
const LEAGUE_TIME_ZONE = "America/Santo_Domingo";

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
