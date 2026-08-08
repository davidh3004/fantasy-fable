-- Rewinds the ACTIVE season to just before its first deadline.
-- SQL twin of scripts/reset-season.ts, for the Supabase SQL editor.
--
-- CLEARS: player stat lines, fixture scores + statuses, gameweek finalized
--         state, banked points on lineups and picks, transfer history, chips
--         played, team totals and ranks.
-- KEEPS:  the calendar (gameweeks + fixtures keep their dates), and every
--         team, squad and saved lineup — nobody has to re-onboard.
--
-- The bank is recomputed as budget minus what each squad actually cost, so it
-- stays consistent with the players a team still holds after transfers.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Take a backup first if you care about the data.
-- Everything runs in one transaction: it either all applies or none of it does.

begin;

-- Fail loudly rather than silently resetting nothing.
do $$
begin
  if not exists (select 1 from seasons where is_active) then
    raise exception 'No active season — nothing to reset.';
  end if;
end $$;

-- 1. Match results and the stat lines scoring reads.
delete from player_match_stats
where fixture_id in (
  select f.id
  from fixtures f
  join gameweeks g on g.id = f.gameweek_id
  join seasons s on s.id = g.season_id
  where s.is_active
);

update fixtures
set status = 'scheduled', home_score = null, away_score = null
where gameweek_id in (
  select g.id from gameweeks g
  join seasons s on s.id = g.season_id
  where s.is_active
);

-- 2. Gameweeks back to upcoming, keeping their deadlines.
update gameweeks
set status = 'upcoming', finalized_at = null
where season_id in (select id from seasons where is_active);

-- 3. Banked points. Lineups themselves stay, so nobody loses their picks.
update lineup_picks
set points = null
where lineup_id in (
  select gl.id
  from gameweek_lineups gl
  join fantasy_teams ft on ft.id = gl.fantasy_team_id
  join seasons s on s.id = ft.season_id
  where s.is_active
);

update gameweek_lineups
set points = null, transfers_cost = 0, chip = null
where fantasy_team_id in (
  select ft.id from fantasy_teams ft
  join seasons s on s.id = ft.season_id
  where s.is_active
);

-- 4. Season history: transfers made and chips played.
delete from transfers
where fantasy_team_id in (
  select ft.id from fantasy_teams ft
  join seasons s on s.id = ft.season_id
  where s.is_active
);

delete from chip_plays
where fantasy_team_id in (
  select ft.id from fantasy_teams ft
  join seasons s on s.id = ft.season_id
  where s.is_active
);

-- 5. Team totals, ranks and bank.
update fantasy_teams ft
set total_points = 0,
    overall_rank = null,
    previous_overall_rank = null,
    free_transfers = gs.free_transfers_per_gw,
    budget = gs.budget - coalesce((
      select sum(sp.purchase_price)
      from squad_picks sp
      where sp.fantasy_team_id = ft.id
    ), 0)
from seasons s
join game_settings gs on gs.season_id = s.id
where s.is_active and ft.season_id = s.id;

commit;

-- Sanity check — run after committing. Every count should be 0 except teams.
-- select
--   (select count(*) from player_match_stats pms
--      join fixtures f on f.id = pms.fixture_id
--      join gameweeks g on g.id = f.gameweek_id
--      join seasons s on s.id = g.season_id where s.is_active)      as stat_rows,
--   (select count(*) from gameweeks g join seasons s on s.id = g.season_id
--      where s.is_active and g.status <> 'upcoming')                as non_upcoming_gws,
--   (select count(*) from fixtures f join gameweeks g on g.id = f.gameweek_id
--      join seasons s on s.id = g.season_id
--      where s.is_active and (f.home_score is not null
--        or f.status <> 'scheduled'))                               as fixtures_with_results,
--   (select count(*) from fantasy_teams ft join seasons s on s.id = ft.season_id
--      where s.is_active and ft.total_points <> 0)                  as teams_with_points,
--   (select count(*) from fantasy_teams ft join seasons s on s.id = ft.season_id
--      where s.is_active)                                           as teams_kept;
