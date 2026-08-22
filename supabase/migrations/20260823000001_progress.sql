-- Phase 6b: server-authoritative XP/coins/streak/daily-claims/quest/
-- achievements, replacing useProgressStore's local-only logic (Phase 4).
-- Uses SECURITY DEFINER Postgres functions exposed via PostgREST RPC
-- instead of actual Edge Functions - same "client can't touch these
-- values directly, only through a validated server-side action" property
-- (BACKEND_PLAN.md §5/§11), deployable through the SQL Editor like the
-- Phase 6a migration (no CLI/access-token needed - see PROGRESS_AUDIT.md
-- for why that's still blocked in this environment).
--
-- Only one quest and one "today's culture discovery" exist in the app
-- right now (both hardcoded client-side), so quest/culture-discovery
-- progress lives as columns on user_progress rather than a full
-- quests/culture_items relational system - matches BACKEND_PLAN.md's own
-- "don't build CMS tables for content that has no CMS yet" scoping
-- (that's Phase 6c). explore discoveries (4 hardcoded items, each with
-- its own id) get a real table since "has this specific id been found"
-- needs a real per-item check, not a single counter.

create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  games_won integer not null default 0 check (games_won >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_active_date date,
  wins_today integer not null default 0 check (wins_today >= 0),
  plays_today integer not null default 0 check (plays_today >= 0),
  daily_counters_date date,
  daily_challenge_claimed_date date,
  daily_gift_claimed_date date,
  daily_play_claimed_date date,
  quest_found_count integer not null default 0 check (quest_found_count >= 0 and quest_found_count <= 5),
  quest_completed boolean not null default false,
  boz_uy_visited boolean not null default false,
  culture_discovery_count integer not null default 0 check (culture_discovery_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.user_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  played integer not null default 0 check (played >= 0),
  won integer not null default 0 check (won >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null check (achievement_id in ('first-win', 'traveler', 'boz-uy-guest', 'komuzchu')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.user_discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_id text not null,
  discovered_at timestamptz not null default now(),
  primary key (user_id, discovery_id)
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  type text not null,
  source text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

-- RLS: every table here is select-only for the owning user. There is no
-- insert/update/delete policy for the client role on any of them,
-- anywhere in this file - every mutation happens inside a SECURITY
-- DEFINER function below, which is the actual enforcement of "never trust
-- the client" (master prompt §11), not just a convention.

alter table public.user_progress enable row level security;
create policy "select own progress" on public.user_progress for select using (auth.uid() = user_id);

alter table public.user_game_stats enable row level security;
create policy "select own game stats" on public.user_game_stats for select using (auth.uid() = user_id);

alter table public.user_achievements enable row level security;
create policy "select own achievements" on public.user_achievements for select using (auth.uid() = user_id);

alter table public.user_discoveries enable row level security;
create policy "select own discoveries" on public.user_discoveries for select using (auth.uid() = user_id);

alter table public.xp_events enable row level security;
create policy "select own xp events" on public.xp_events for select using (auth.uid() = user_id);

alter table public.coin_transactions enable row level security;
create policy "select own coin transactions" on public.coin_transactions for select using (auth.uid() = user_id);

create function public.handle_new_user_progress()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_progress (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_progress
  after insert on auth.users
  for each row execute procedure public.handle_new_user_progress();

-- The trigger only fires for signups from here on - every account
-- created before this migration ran (including real ones already in
-- production use) has no user_progress row at all yet. Backfill them
-- now so `select ... single()` on the client doesn't come back empty for
-- an existing user.
insert into public.user_progress (user_id)
select id from auth.users
where id not in (select user_id from public.user_progress)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- Internal helpers. These take a user_id parameter and MUST NEVER be
-- directly callable by a client - an authenticated user could otherwise
-- pass an arbitrary user_id and award rewards to (or reset the daily
-- counters of) any other account. Only the top-level action functions
-- below (which derive auth.uid() themselves and take no user_id
-- parameter) are granted EXECUTE to `authenticated`.
-- ---------------------------------------------------------------------

create function public.apply_daily_reset(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_today date := current_date;
  v_row public.user_progress;
begin
  select * into v_row from public.user_progress where user_id = p_user_id for update;

  if v_row.daily_counters_date is distinct from v_today then
    update public.user_progress
    set wins_today = 0, plays_today = 0, daily_counters_date = v_today
    where user_id = p_user_id;
  end if;

  if v_row.last_active_date is distinct from v_today then
    update public.user_progress
    set streak_days = case
        when last_active_date is null then 1
        when v_today - last_active_date = 1 then streak_days + 1
        else 1
      end,
      last_active_date = v_today
    where user_id = p_user_id;
  end if;
end;
$$;
revoke execute on function public.apply_daily_reset(uuid) from public, anon, authenticated;

create function public.apply_reward(p_user_id uuid, p_xp int, p_coins int, p_source text, p_reference_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.user_progress set xp = xp + p_xp, coins = coins + p_coins, updated_at = now() where user_id = p_user_id;
  if p_xp <> 0 then
    insert into public.xp_events (user_id, amount, source, reference_id) values (p_user_id, p_xp, p_source, p_reference_id);
  end if;
  if p_coins <> 0 then
    insert into public.coin_transactions (user_id, amount, type, source, reference_id) values (p_user_id, p_coins, 'reward', p_source, p_reference_id);
  end if;
end;
$$;
revoke execute on function public.apply_reward(uuid, int, int, text, text) from public, anon, authenticated;

create function public.check_achievements(p_user_id uuid)
returns text[]
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.user_progress;
  v_newly text[] := '{}';
begin
  select * into v_row from public.user_progress where user_id = p_user_id;

  if v_row.games_won >= 1 and not exists (select 1 from public.user_achievements where user_id = p_user_id and achievement_id = 'first-win') then
    insert into public.user_achievements (user_id, achievement_id) values (p_user_id, 'first-win');
    v_newly := array_append(v_newly, 'first-win');
  end if;

  if v_row.quest_completed and not exists (select 1 from public.user_achievements where user_id = p_user_id and achievement_id = 'traveler') then
    insert into public.user_achievements (user_id, achievement_id) values (p_user_id, 'traveler');
    v_newly := array_append(v_newly, 'traveler');
  end if;

  if v_row.boz_uy_visited and not exists (select 1 from public.user_achievements where user_id = p_user_id and achievement_id = 'boz-uy-guest') then
    insert into public.user_achievements (user_id, achievement_id) values (p_user_id, 'boz-uy-guest');
    v_newly := array_append(v_newly, 'boz-uy-guest');
  end if;

  if v_row.culture_discovery_count >= 1 and not exists (select 1 from public.user_achievements where user_id = p_user_id and achievement_id = 'komuzchu') then
    insert into public.user_achievements (user_id, achievement_id) values (p_user_id, 'komuzchu');
    v_newly := array_append(v_newly, 'komuzchu');
  end if;

  return v_newly;
end;
$$;
revoke execute on function public.check_achievements(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Top-level actions. Each derives the caller's identity from auth.uid()
-- (never from a client-supplied parameter), re-derives its own reward
-- amount (never accepts one from the client - master prompt §11/§12/§13),
-- and returns jsonb: { progress: <full user_progress row>, newlyUnlocked?:
-- string[] }. "Already claimed"/"not eligible" are hard rejections
-- (a raised exception, which supabase-js surfaces as a real error), not a
-- success response with a flag the client could ignore.
-- ---------------------------------------------------------------------

create function public.record_game_played(p_game_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  update public.user_progress set games_played = games_played + 1, plays_today = plays_today + 1, updated_at = now()
  where user_id = v_user_id;

  insert into public.user_game_stats (user_id, game_id, played, won)
  values (v_user_id, p_game_id, 1, 0)
  on conflict (user_id, game_id) do update set played = public.user_game_stats.played + 1, updated_at = now();

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.record_game_played(text) to authenticated;

create function public.record_game_won(p_game_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_newly text[];
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  update public.user_progress set games_won = games_won + 1, wins_today = wins_today + 1, updated_at = now()
  where user_id = v_user_id;

  insert into public.user_game_stats (user_id, game_id, played, won)
  values (v_user_id, p_game_id, 0, 1)
  on conflict (user_id, game_id) do update set won = public.user_game_stats.won + 1, updated_at = now();

  v_newly := public.check_achievements(v_user_id);
  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.record_game_won(text) to authenticated;

create function public.claim_daily_challenge()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_today date := current_date;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if v_row.wins_today < 1 then raise exception 'NOT_ELIGIBLE'; end if;
  if v_row.daily_challenge_claimed_date = v_today then raise exception 'ALREADY_CLAIMED'; end if;

  update public.user_progress set daily_challenge_claimed_date = v_today, updated_at = now() where user_id = v_user_id;
  perform public.apply_reward(v_user_id, 100, 50, 'daily_challenge', null);

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.claim_daily_challenge() to authenticated;

create function public.claim_daily_gift()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_today date := current_date;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if v_row.daily_gift_claimed_date = v_today then raise exception 'ALREADY_CLAIMED'; end if;

  update public.user_progress set daily_gift_claimed_date = v_today, updated_at = now() where user_id = v_user_id;
  perform public.apply_reward(v_user_id, 20, 30, 'daily_gift', null);

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.claim_daily_gift() to authenticated;

create function public.claim_daily_play()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_today date := current_date;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if v_row.plays_today < 3 then raise exception 'NOT_ELIGIBLE'; end if;
  if v_row.daily_play_claimed_date = v_today then raise exception 'ALREADY_CLAIMED'; end if;

  update public.user_progress set daily_play_claimed_date = v_today, updated_at = now() where user_id = v_user_id;
  perform public.apply_reward(v_user_id, 30, 20, 'daily_play', null);

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.claim_daily_play() to authenticated;

create function public.advance_quest()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_newly text[] := '{}';
  v_just_completed boolean;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if v_row.quest_completed then raise exception 'ALREADY_COMPLETED'; end if;

  update public.user_progress
  set quest_found_count = quest_found_count + 1,
      quest_completed = (quest_found_count + 1) >= 5,
      updated_at = now()
  where user_id = v_user_id
  returning quest_completed into v_just_completed;

  if v_just_completed then
    perform public.apply_reward(v_user_id, 80, 40, 'quest_complete', 'lost-shyrdak');
  end if;

  v_newly := public.check_achievements(v_user_id);
  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.advance_quest() to authenticated;

create function public.visit_boz_uy()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_newly text[] := '{}';
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if not v_row.boz_uy_visited then
    update public.user_progress set boz_uy_visited = true, updated_at = now() where user_id = v_user_id;
    perform public.apply_reward(v_user_id, 15, 0, 'boz_uy_visit', null);
    v_newly := public.check_achievements(v_user_id);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.visit_boz_uy() to authenticated;

create function public.discover_culture()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_newly text[] := '{}';
  v_first boolean;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  v_first := v_row.culture_discovery_count = 0;

  update public.user_progress set culture_discovery_count = culture_discovery_count + 1, updated_at = now()
  where user_id = v_user_id;

  if v_first then
    perform public.apply_reward(v_user_id, 15, 0, 'culture_discovery', null);
  end if;

  v_newly := public.check_achievements(v_user_id);
  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.discover_culture() to authenticated;

create function public.discover_explore_item(p_discovery_id text, p_xp_reward int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_rows int;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  insert into public.user_discoveries (user_id, discovery_id) values (v_user_id, p_discovery_id) on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    perform public.apply_reward(v_user_id, p_xp_reward, 0, 'explore_discovery', p_discovery_id);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.discover_explore_item(text, int) to authenticated;
