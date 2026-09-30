-- Regional Challenges 1.0: results of a region's knowledge challenge are
-- stored under 'region:<region-id>' (e.g. 'region:naryn'), next to the
-- existing daily / collection / journey keys, so they sync across devices
-- like every other challenge. Same table, same merge rules; the only change
-- is the allowed key pattern. Challenges still grant no XP or coins.

alter table public.user_challenge_results drop constraint if exists user_challenge_results_challenge_key_check;
alter table public.user_challenge_results add constraint user_challenge_results_challenge_key_check
  check (challenge_key ~ '^(daily:\d{4}-\d{2}-\d{2}|collection:[a-z0-9-]{1,60}|region:[a-z0-9-]{1,60}|journey)$');

create or replace function public.merge_challenge_results(p_items jsonb)
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
    if v_key is null or v_key !~ '^(daily:\d{4}-\d{2}-\d{2}|collection:[a-z0-9-]{1,60}|region:[a-z0-9-]{1,60}|journey)$' then continue; end if;

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
