-- Previous overall rank, so the home dashboard can show movement arrows.
--
-- `overall_rank` is rewritten on every finalize, which leaves nothing to
-- compare against. This column holds the value it had before the most recent
-- finalize, making "moved up 4 places last gameweek" derivable as
-- previous_overall_rank - overall_rank.
--
-- Null means "no movement known yet" — a team's first finalize, or a gameweek
-- that was unfinalized (the pre-finalize value is unrecoverable there, and a
-- null renders no arrow rather than a wrong one).
--
-- Safe to re-run.
alter table fantasy_teams
  add column if not exists previous_overall_rank integer;
