-- Cross-device account sync for the progress that was still device-only
-- (see src/services/sync/README-style notes in syncEngine.ts):
--
--   * Daily OYNO completions   -> user_daily_completions   (new)
--   * Knowledge Challenge results -> user_challenge_results (new)
--   * Wallpaper favorites      -> the EXISTING user_favorites table, as a
--     new 'wallpaper' target_type (no second favorites system)
--
-- Everything already server-backed (user_progress, user_game_stats,
-- user_achievements, user_discoveries, user_region_visits,
-- user_quest_steps, user_favorites, user_settings, user_avatars) is reused
-- as-is - no duplicate tables.
--
-- Same security model as the rest of this project: select-only RLS for
-- the owning user, every write goes through a SECURITY DEFINER function
-- that derives auth.uid() itself and applies the merge rule server-side,
-- so two devices syncing at once can never lower a best score or
-- "un-complete" a day.

-- ---------------------------------------------------------------------
-- Daily OYNO completions. Completed wins: rows are insert-only - there is
-- no update or delete path, so a completed day can never be lost. If two
-- devices completed the same date, the first one stored is kept.
-- ---------------------------------------------------------------------
create table public.user_daily_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  item_id text not null check (char_length(item_id) between 1 and 120),
  completed_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.user_daily_completions enable row level security;
create policy "select own daily completions" on public.user_daily_completions for select using (auth.uid() = user_id);

-- p_items: [{ "date_key": "2026-09-23", "item_id": "komuz-overview" }, ...]
-- Returns every stored completion for the caller after the merge.
create function public.merge_daily_completions(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'date_key') ~ '^\d{4}-\d{2}-\d{2}$' and char_length(coalesce(v_item->>'item_id', '')) between 1 and 120 then
      insert into public.user_daily_completions (user_id, date_key, item_id)
      values (v_user_id, v_item->>'date_key', v_item->>'item_id')
      on conflict (user_id, date_key) do nothing;
    end if;
  end loop;

  return coalesce(
    (select jsonb_agg(jsonb_build_object('date_key', date_key, 'item_id', item_id, 'completed_at', completed_at) order by date_key)
     from public.user_daily_completions where user_id = v_user_id),
    '[]'::jsonb
  );
end;
$$;
grant execute on function public.merge_daily_completions(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Knowledge Challenge results. challenge_key: 'daily:YYYY-MM-DD',
-- 'collection:<id>' or 'journey'. Merge rule (mirrors
-- src/services/sync/mergeRules.ts mergeChallengeResult):
--   best_correct  -> highest (never lowered), capped by its total
--   attempts      -> highest seen (devices can't be summed without
--                    double counting)
--   started_at    -> earliest
--   completed_at  -> earliest non-null (completed wins)
--   last_correct / last_total -> from the most recently updated record
-- ---------------------------------------------------------------------
create table public.user_challenge_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_key text not null check (challenge_key ~ '^(daily:\d{4}-\d{2}-\d{2}|collection:[a-z0-9-]{1,60}|journey)$'),
  best_correct integer not null default 0 check (best_correct between 0 and 50),
  last_correct integer not null default 0 check (last_correct between 0 and 50),
  last_total integer not null default 0 check (last_total between 0 and 50),
  attempts integer not null default 0 check (attempts between 0 and 100000),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_key)
);

alter table public.user_challenge_results enable row level security;
create policy "select own challenge results" on public.user_challenge_results for select using (auth.uid() = user_id);

-- p_items: [{ challenge_key, best_correct, last_correct, last_total,
--             attempts, started_at, completed_at, updated_at }, ...]
-- Returns every stored result for the caller after the merge.
create function public.merge_challenge_results(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_key text;
  v_total int;
  v_last int;
  v_best int;
  v_attempts int;
  v_updated timestamptz;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_key := v_item->>'challenge_key';
    if v_key is null or v_key !~ '^(daily:\d{4}-\d{2}-\d{2}|collection:[a-z0-9-]{1,60}|journey)$' then continue; end if;

    v_total := least(greatest(coalesce((v_item->>'last_total')::int, 0), 0), 50);
    v_last := least(greatest(coalesce((v_item->>'last_correct')::int, 0), 0), v_total);
    -- A "best" can't exceed the questions that challenge has ever had:
    -- a legitimate run never scores above its own total.
    v_best := least(greatest(coalesce((v_item->>'best_correct')::int, 0), 0), 50);
    v_attempts := least(greatest(coalesce((v_item->>'attempts')::int, 0), 0), 100000);
    v_updated := least(coalesce((v_item->>'updated_at')::timestamptz, now()), now());

    insert into public.user_challenge_results as r (
      user_id, challenge_key, best_correct, last_correct, last_total, attempts, started_at, completed_at, updated_at
    ) values (
      v_user_id, v_key, least(v_best, greatest(v_total, v_last)), v_last, v_total, v_attempts,
      (v_item->>'started_at')::timestamptz, (v_item->>'completed_at')::timestamptz, v_updated
    )
    on conflict (user_id, challenge_key) do update set
      best_correct = greatest(r.best_correct, excluded.best_correct),
      attempts = greatest(r.attempts, excluded.attempts),
      started_at = least(r.started_at, excluded.started_at),
      completed_at = least(r.completed_at, excluded.completed_at),
      last_correct = case when excluded.updated_at > r.updated_at then excluded.last_correct else r.last_correct end,
      last_total = case when excluded.updated_at > r.updated_at then excluded.last_total else r.last_total end,
      updated_at = greatest(r.updated_at, excluded.updated_at);
  end loop;

  return coalesce(
    (select jsonb_agg(jsonb_build_object(
        'challenge_key', challenge_key, 'best_correct', best_correct, 'last_correct', last_correct,
        'last_total', last_total, 'attempts', attempts, 'started_at', started_at,
        'completed_at', completed_at, 'updated_at', updated_at) order by challenge_key)
     from public.user_challenge_results where user_id = v_user_id),
    '[]'::jsonb
  );
end;
$$;
grant execute on function public.merge_challenge_results(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Wallpaper favorites join the one favorites system. Only the CHECK
-- constraint changes (same approach as
-- 20260920000001_favorites_all_content_types.sql); toggle_favorite()
-- already handles any (target_type, target_id).
-- ---------------------------------------------------------------------
alter table public.user_favorites drop constraint if exists user_favorites_target_type_check;

alter table public.user_favorites add constraint user_favorites_target_type_check
  check (target_type in ('region', 'nature', 'game', 'culture_material', 'culture_item', 'interactive_experience', 'wallpaper'));
