-- Performance indexes for the hot query paths (see SPEC.md review).
-- Postgres does NOT auto-index foreign keys, so these columns were being
-- sequentially scanned as data grows. Names match the Drizzle schema so a
-- later `drizzle-kit push` sees them as already applied.
--
-- CONCURRENTLY builds the index without locking writes — safe on a live DB.
-- It cannot run inside a transaction, so run these statements one at a time
-- (Supabase SQL editor runs each separately; `npm run db:indexes` handles it).

-- Season-scoped standings / ranking (every home + leagues render, finalize).
CREATE INDEX CONCURRENTLY IF NOT EXISTS fantasy_teams_season_points_idx
  ON fantasy_teams (season_id, total_points);

-- Fixtures of a gameweek (home, matches, finalize, deadline recompute).
CREATE INDEX CONCURRENTLY IF NOT EXISTS fixtures_gameweek_idx
  ON fixtures (gameweek_id);

-- All lineups of a gameweek (finalize + live standings gw-points).
CREATE INDEX CONCURRENTLY IF NOT EXISTS gameweek_lineups_gameweek_idx
  ON gameweek_lineups (gameweek_id);

-- Players of a club (market list, admin players, squad joins).
CREATE INDEX CONCURRENTLY IF NOT EXISTS players_club_idx
  ON players (club_id);

-- League membership by team ("my leagues", leave, standings join).
CREATE INDEX CONCURRENTLY IF NOT EXISTS mini_league_members_team_idx
  ON mini_league_members (fantasy_team_id);
