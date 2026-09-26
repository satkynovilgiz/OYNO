-- Guided Quests 2.0: short themed adventures across Explore, Culture labs,
-- Games and Challenges. Quest text (KG/RU/EN) and routes live in the app
-- (src/features/quests/questsData.ts); this migration stores only what the
-- server needs to verify a completion before granting the existing reward
-- (XP + coins via apply_reward) - once per account.
--
-- Step types map to real, already-recorded signals only:
--   play_game             user_game_stats.played > 0 (target = recorded game id)
--   explore_destination   user_region_visits row
--   complete_interactive  user_progress flag (boz-uy / oymo / shyrdak / komuz)
--   complete_challenge    user_challenge_results.completed_at (target = challenge key)
-- Opening a screen never counts.

create table public.guided_quest_steps (
  quest_id text not null,
  step_order int not null check (step_order between 1 and 20),
  step_type text not null check (step_type in ('play_game', 'explore_destination', 'complete_interactive', 'complete_challenge')),
  target_id text not null,
  primary key (quest_id, step_order)
);
-- Server-only requirement data: RLS on, no client policy.
alter table public.guided_quest_steps enable row level security;

create table public.guided_quest_rewards (
  quest_id text primary key,
  xp int not null check (xp between 0 and 500),
  coins int not null check (coins between 0 and 500)
);
alter table public.guided_quest_rewards enable row level security;

create table public.user_guided_quests (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);
alter table public.user_guided_quests enable row level security;
create policy "select own guided quests" on public.user_guided_quests for select using (auth.uid() = user_id);

insert into public.guided_quest_rewards (quest_id, xp, coins) values
  ('inside-boz-uy', 80, 40),
  ('craft-and-ornament', 80, 40),
  ('horse-games', 80, 40),
  ('mountain-journey', 80, 40);

insert into public.guided_quest_steps (quest_id, step_order, step_type, target_id) values
  ('inside-boz-uy', 1, 'complete_interactive', 'boz-uy'),
  ('inside-boz-uy', 2, 'complete_interactive', 'shyrdak'),
  ('inside-boz-uy', 3, 'complete_challenge', 'collection:boz-uy-world'),
  ('craft-and-ornament', 1, 'complete_interactive', 'oymo'),
  ('craft-and-ornament', 2, 'complete_interactive', 'shyrdak'),
  ('craft-and-ornament', 3, 'complete_challenge', 'collection:kyrgyz-ornament'),
  ('horse-games', 1, 'play_game', 'kok_boru'),
  ('horse-games', 2, 'play_game', 'kyz_kuumai'),
  ('horse-games', 3, 'complete_challenge', 'collection:horse-culture'),
  ('mountain-journey', 1, 'explore_destination', 'son-kol'),
  ('mountain-journey', 2, 'explore_destination', 'suusamyr'),
  ('mountain-journey', 3, 'explore_destination', 'sary-chelek'),
  ('mountain-journey', 4, 'complete_challenge', 'journey');

create function public.guided_quest_step_done(p_user_id uuid, p_type text, p_target text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_progress public.user_progress;
begin
  if p_type = 'play_game' then
    return exists (select 1 from public.user_game_stats where user_id = p_user_id and game_id = p_target and played > 0);
  elsif p_type = 'explore_destination' then
    return exists (select 1 from public.user_region_visits where user_id = p_user_id and region_id = p_target);
  elsif p_type = 'complete_challenge' then
    return exists (select 1 from public.user_challenge_results where user_id = p_user_id and challenge_key = p_target and completed_at is not null);
  elsif p_type = 'complete_interactive' then
    select * into v_progress from public.user_progress where user_id = p_user_id;
    return case p_target
      when 'boz-uy' then coalesce(v_progress.boz_uy_visited, false)
      when 'oymo' then coalesce(v_progress.oymo_created, false)
      when 'shyrdak' then coalesce(v_progress.shyrdak_created, false)
      when 'komuz' then coalesce(v_progress.komuz_lesson_completed, false)
      else false
    end;
  end if;
  return false;
end;
$$;
-- Internal helper: takes a user id on purpose, so never callable by clients.
revoke execute on function public.guided_quest_step_done(uuid, text, text) from public, anon, authenticated;

create function public.claim_guided_quest(p_quest_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward public.guided_quest_rewards;
  v_missing int;
  v_row public.user_progress;
  v_newly text[] := '{}';
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_reward from public.guided_quest_rewards where quest_id = p_quest_id;
  if v_reward.quest_id is null then raise exception 'UNKNOWN_QUEST'; end if;
  perform public.apply_daily_reset(v_user_id);

  if exists (select 1 from public.user_guided_quests where user_id = v_user_id and quest_id = p_quest_id) then
    select * into v_row from public.user_progress where user_id = v_user_id;
    return jsonb_build_object('claimed', false, 'alreadyClaimed', true, 'progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
  end if;

  select count(*) into v_missing
  from public.guided_quest_steps s
  where s.quest_id = p_quest_id and not public.guided_quest_step_done(v_user_id, s.step_type, s.target_id);

  if v_missing > 0 then
    select * into v_row from public.user_progress where user_id = v_user_id;
    return jsonb_build_object('claimed', false, 'missing', v_missing, 'progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
  end if;

  insert into public.user_guided_quests (user_id, quest_id) values (v_user_id, p_quest_id) on conflict do nothing;
  if found then
    perform public.apply_reward(v_user_id, v_reward.xp, v_reward.coins, 'guided_quest', p_quest_id);
    v_newly := public.check_achievements(v_user_id);
  end if;
  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('claimed', true, 'xp', v_reward.xp, 'coins', v_reward.coins, 'progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.claim_guided_quest(text) to authenticated;
