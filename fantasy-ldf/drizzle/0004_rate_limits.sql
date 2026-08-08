-- Fixed-window rate limit counters for server actions.
--
-- The app has no throttling of its own: Supabase rate-limits its own auth
-- endpoints, but nothing stopped a signed-in user from hammering an action.
-- The concrete case is joinLeague, where invite codes are six characters from
-- a 32-symbol alphabet — a bot with unlimited attempts can rastrillar them and
-- walk into private leagues.
--
-- Counting has to live in the database rather than in process memory: the app
-- runs as serverless functions, so each instance would keep its own counter
-- and an attacker could simply spread attempts across instances.
--
-- One row per "<action>:<userId>" key. A row whose window has expired is reset
-- in place on its next hit, so nothing needs cleaning up; the table stays
-- roughly as large as the number of distinct users who used a guarded action.
--
-- RLS is enabled with no policy, like every other table here: only the app's
-- own connection (which bypasses RLS) touches it.
--
-- Safe to re-run.
create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;
