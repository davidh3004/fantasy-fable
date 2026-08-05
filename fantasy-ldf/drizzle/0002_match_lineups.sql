-- Live match console: per-fixture lineup + substitution bookkeeping.
--
-- `minutes` on player_match_stats stays the value the scoring engine reads;
-- these columns are what the console derives it from, so a starter who is
-- never subbed accrues minutes as the match clock runs, and a substitute only
-- accrues from the minute they came on.
--
-- Safe to re-run. Existing rows default to started = false with null on/off,
-- which leaves their already-entered `minutes` untouched.

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS started boolean NOT NULL DEFAULT false;

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS on_minute smallint;

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS off_minute smallint;
