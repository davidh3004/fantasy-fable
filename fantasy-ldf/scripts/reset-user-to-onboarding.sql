-- Reset a user back to onboarding.
--
-- Deletes the user's fantasy team and all rows that depend on it, so the next
-- sign-in lands on /onboarding. Keeps the auth account and profile intact.
-- The schema has no ON DELETE CASCADE, so children are removed first, in order.
--
-- Usage: paste into the Supabase SQL editor, set v_email, and run.
-- Safe to run repeatedly (a no-op once the user has no team).

do $$
declare
  v_email text := 'test-user@example.com';  -- <-- change to the target user
  v_user  uuid;
begin
  select id into v_user from auth.users where email = v_email;

  if v_user is null then
    raise notice 'No auth user found for %', v_email;
    return;
  end if;

  delete from lineup_picks
   where lineup_id in (
     select gl.id
       from gameweek_lineups gl
       join fantasy_teams ft on ft.id = gl.fantasy_team_id
      where ft.user_id = v_user
   );

  delete from gameweek_lineups
   where fantasy_team_id in (select id from fantasy_teams where user_id = v_user);

  delete from squad_picks
   where fantasy_team_id in (select id from fantasy_teams where user_id = v_user);

  delete from transfers
   where fantasy_team_id in (select id from fantasy_teams where user_id = v_user);

  delete from chip_plays
   where fantasy_team_id in (select id from fantasy_teams where user_id = v_user);

  delete from mini_league_members
   where fantasy_team_id in (select id from fantasy_teams where user_id = v_user);

  delete from fantasy_teams where user_id = v_user;

  raise notice 'Reset % back to onboarding.', v_email;
end $$;
