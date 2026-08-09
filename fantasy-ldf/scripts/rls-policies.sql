-- ===========================================================================
-- RLS hardening — PROPOSAL. Nothing here has been run against the database.
--
-- Context (audited 2026-08-08):
--   * All 18 public tables already have RLS enabled, with ZERO policies.
--     RLS enabled + no policy = deny everything, for every role that does not
--     bypass RLS. So `anon` and `authenticated` can already read nothing.
--   * The app never touches PostgREST for data. It connects with DATABASE_URL
--     as the `postgres` role, which has rolbypassrls = true. RLS does not
--     apply to it, and none of this file changes app behaviour.
--   * What is actually loose is the GRANTs: anon and authenticated hold
--     DELETE, INSERT, SELECT, UPDATE, TRUNCATE, REFERENCES, TRIGGER on every
--     table. Those are dormant only because no policy lets a row through —
--     except TRUNCATE, which row-level policies never filter.
--
-- STEP 1 has been applied. Steps 2 and 3 are only needed if you ever query
-- these tables straight from the browser with the anon key.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — Take away the privileges nobody uses  [APPLIED 2026-08-08]
-- ---------------------------------------------------------------------------
-- Removed the standing grants: 252 of them, down to zero. Now even a future
-- accidental policy cannot hand out write access, and TRUNCATE — which row
-- policies never filter — stops being reachable at all.
--
-- Kept working, checked afterwards: the app reads fine (it connects as
-- `postgres`), RLS is still on for all 18 tables, and EXECUTE on
-- public.is_admin() survived, which the storage upload policies depend on.
--
-- Re-run safe. To undo: grant the privileges back per table.

revoke all on all tables in schema public from anon, authenticated;

-- Stop new tables from being born with the same grants.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- Verify (expect zero rows):
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon','authenticated');


-- ---------------------------------------------------------------------------
-- STEP 2 — Ownership helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the policy can look at fantasy_teams without needing a
-- policy on fantasy_teams itself (avoids recursion). search_path pinned, same
-- shape as the existing public.is_admin().

create or replace function public.owns_team(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from fantasy_teams t
    where t.id = team and t.user_id = auth.uid()
  );
$$;

revoke all on function public.owns_team(uuid) from public;
grant execute on function public.owns_team(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- STEP 3 — Owner policies  [NOT APPLIED — visibility model A]
-- ---------------------------------------------------------------------------
-- Model A, chosen 2026-08-08: a team's name, points and rank are public to
-- signed-in managers, because a fantasy league without a visible table is not
-- a league. What stays private is the part that confers an advantage — the
-- squad, the lineups, the transfers and the chips.
--
-- Only meaningful together with matching SELECT/INSERT/UPDATE/DELETE grants
-- to `authenticated`. Grant per table, per command — never `all`.

-- profiles: your own row. Note is_admin is in this table, so UPDATE has to be
-- kept away from it (a self-service UPDATE policy would let anyone make
-- themselves an admin). Read-only here; promotion stays a server-side job.
--
-- Other managers' display names are deliberately NOT exposed here. If the
-- standings need them client-side, add a view over (id, display_name) only —
-- never widen this policy, or is_admin travels with it.
create policy profiles_select_own on profiles
  for select to authenticated
  using (id = auth.uid());

-- fantasy_teams: readable by any signed-in manager (this is the standings
-- table). Writes stay with the owner — note the separate policies: a single
-- `for all` here would have made the whole table writable by everyone.
create policy fantasy_teams_select_all on fantasy_teams
  for select to authenticated
  using (true);

create policy fantasy_teams_update_own on fantasy_teams
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy fantasy_teams_insert_own on fantasy_teams
  for insert to authenticated
  with check (user_id = auth.uid());

-- Squad, lineups, transfers, chips: owned through fantasy_team_id.
create policy squad_picks_own on squad_picks
  for all to authenticated
  using (owns_team(fantasy_team_id))
  with check (owns_team(fantasy_team_id));

create policy gameweek_lineups_own on gameweek_lineups
  for all to authenticated
  using (owns_team(fantasy_team_id))
  with check (owns_team(fantasy_team_id));

create policy transfers_own on transfers
  for all to authenticated
  using (owns_team(fantasy_team_id))
  with check (owns_team(fantasy_team_id));

create policy chip_plays_own on chip_plays
  for all to authenticated
  using (owns_team(fantasy_team_id))
  with check (owns_team(fantasy_team_id));

-- lineup_picks hangs off gameweek_lineups, one hop further out.
create policy lineup_picks_own on lineup_picks
  for all to authenticated
  using (
    exists (
      select 1 from gameweek_lineups l
      where l.id = lineup_picks.lineup_id and owns_team(l.fantasy_team_id)
    )
  )
  with check (
    exists (
      select 1 from gameweek_lineups l
      where l.id = lineup_picks.lineup_id and owns_team(l.fantasy_team_id)
    )
  );

-- Membership lookup, as SECURITY DEFINER for the same reason as owns_team:
-- a policy on mini_league_members cannot subquery mini_league_members without
-- recursing. Running as the owner breaks the loop.
create or replace function public.in_league(league uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from mini_league_members m
    join fantasy_teams t on t.id = m.fantasy_team_id
    where m.league_id = league and t.user_id = auth.uid()
  );
$$;

revoke all on function public.in_league(uuid) from public;
grant execute on function public.in_league(uuid) to authenticated;

-- Mini-leagues: the owner administers, members see the league they joined.
-- The invite_code lives on this row, so non-members must not read it — that
-- code is what lets someone into a private league.
create policy mini_leagues_select_member on mini_leagues
  for select to authenticated
  using (owner_id = auth.uid() or in_league(id));

create policy mini_leagues_write_owner on mini_leagues
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Membership rows: everyone in a league can see who else is in it (model A —
-- this is what draws the league table). Joining and leaving stays your own.
create policy mini_league_members_select_league on mini_league_members
  for select to authenticated
  using (in_league(league_id));

create policy mini_league_members_write_own on mini_league_members
  for all to authenticated
  using (owns_team(fantasy_team_id))
  with check (owns_team(fantasy_team_id));

-- Catalogue tables — the same league data for everyone, read-only. Writes stay
-- server-side; no policy is added for them, so writes remain denied.
create policy competitions_read on competitions
  for select to authenticated using (true);
create policy seasons_read on seasons
  for select to authenticated using (true);
create policy clubs_read on clubs
  for select to authenticated using (true);
create policy players_read on players
  for select to authenticated using (true);
create policy gameweeks_read on gameweeks
  for select to authenticated using (true);
create policy fixtures_read on fixtures
  for select to authenticated using (true);
create policy player_match_stats_read on player_match_stats
  for select to authenticated using (true);
create policy scoring_rules_read on scoring_rules
  for select to authenticated using (true);
create policy game_settings_read on game_settings
  for select to authenticated using (true);

-- Matching grants for the policies above.
grant select on
  competitions, seasons, clubs, players, gameweeks, fixtures,
  player_match_stats, scoring_rules, game_settings, profiles
  to authenticated;
grant select, insert, update on fantasy_teams to authenticated;
grant select, insert, update, delete on
  squad_picks, gameweek_lineups, lineup_picks, transfers, chip_plays,
  mini_leagues, mini_league_members
  to authenticated;
