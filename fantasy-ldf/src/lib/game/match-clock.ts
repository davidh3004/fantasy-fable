/**
 * Match clock and minutes-played derivation for the live results console.
 *
 * Pure functions: the admin records *when* a player entered and left the
 * pitch, and minutes are derived from that plus the current clock. That way a
 * starter's minutes tick up on their own while the match runs, and nobody has
 * to type a number into every row.
 */

export const FULL_TIME_MINUTE = 90;

export type MatchParticipation = {
  /** In the starting eleven. */
  started: boolean;
  /** Minute they entered. Starters are 0; null means they never came on. */
  onMinute: number | null;
  /** Minute they left. Null means still on the pitch. */
  offMinute: number | null;
};

/**
 * Elapsed match minute from kickoff, capped at full time. Only a suggestion —
 * the console lets the admin correct it for halftime and stoppage.
 */
export function elapsedMinute(kickoff: Date, now: Date = new Date()): number {
  const minutes = Math.floor((now.getTime() - kickoff.getTime()) / 60_000);
  return Math.min(Math.max(minutes, 0), FULL_TIME_MINUTE);
}

/**
 * Minutes a player has been on the pitch.
 *
 * `currentMinute` is the live clock while a match is in play, or
 * FULL_TIME_MINUTE once the result is published.
 */
export function minutesPlayed(
  participation: MatchParticipation,
  currentMinute: number
): number {
  const { started, onMinute, offMinute } = participation;

  // Never appeared: an unused substitute.
  if (!started && onMinute == null) return 0;

  const on = started ? 0 : (onMinute ?? 0);
  const off = offMinute ?? currentMinute;
  return Math.max(0, Math.min(off, currentMinute) - on);
}

/** True while the player is on the pitch — drives the rapid-action pickers. */
export function isOnPitch(
  participation: MatchParticipation,
  currentMinute: number
): boolean {
  const { started, onMinute, offMinute } = participation;
  if (!started && onMinute == null) return false;
  if (offMinute != null && offMinute <= currentMinute) return false;
  const on = started ? 0 : (onMinute ?? 0);
  return on <= currentMinute;
}
