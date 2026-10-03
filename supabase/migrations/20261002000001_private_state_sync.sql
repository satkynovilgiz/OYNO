-- Private Cloud Sync 1.0
--
-- One private store for the per-person study data that was device-only:
-- reading progress, highlights + private notes, My Collections, challenge
-- mistakes, glossary study (+ sessions), game records, Komuz favorites,
-- Learning Path manual steps, listening history, audio bookmarks and the
-- weekly goal (see src/services/sync/privateSync/domains.ts for the merge
-- rule of each).
--
-- NOT duplicated here (already synced by their own tables): journal,
-- challenge results, daily completions, favorites, achievements, XP,
-- discoveries, region visits, quests, settings, avatars.
--
-- Security model (same as the rest of this project):
--   * RLS on; the ONLY policy is "select own rows".
--   * No direct insert/update/delete for any client role. Every write goes
--     through push_user_state(), SECURITY DEFINER, which takes the owner
--     from auth.uid() - a user id is never accepted from the app.
--   * Nothing here is exposed to admin content RPCs, analytics or anon.
--     Highlight note text lives only inside the owner's rows.
--
-- Concurrency: each record carries a revision. A push names the revision
-- it was based on; it is applied only if that is still the stored one
-- (compare-and-swap), otherwise the current row is returned so the client
-- merges with the domain's rule and tries again. Retrying the same push
-- is therefore harmless (idempotent). Deletions are kept as tombstones so
-- another device can't bring a deleted record back.

create table public.user_state_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in (
    'reading', 'highlights', 'collections', 'mistakes', 'glossary_study', 'glossary_sessions',
    'game_records', 'komuz_favorites', 'path_steps', 'listening_history', 'audio_bookmarks', 'weekly_goal'
  )),
  record_key text not null check (char_length(record_key) between 1 and 300),
  payload jsonb,
  deleted boolean not null default false,
  rev bigint not null default 1 check (rev >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, domain, record_key),
  check (deleted or payload is not null),
  check (payload is null or jsonb_typeof(payload) = 'object'),
  check (payload is null or pg_column_size(payload) <= 65536)
);

alter table public.user_state_records enable row level security;

create policy "select own state records" on public.user_state_records
  for select using (auth.uid() = user_id);

revoke all on public.user_state_records from anon;
revoke insert, update, delete, truncate on public.user_state_records from authenticated;
grant select on public.user_state_records to authenticated;

create index user_state_records_user_domain_idx on public.user_state_records (user_id, domain, updated_at);

-- p_items: [{ "key": text, "base_rev": int (0 = new), "deleted": bool, "payload": object|null }]
-- Returns { accepted: [row...], conflicts: [row...] } where row =
-- { key, rev, deleted, payload } - only for keys in this call.
create function public.push_user_state(p_domain text, p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_key text;
  v_base bigint;
  v_deleted boolean;
  v_payload jsonb;
  v_row public.user_state_records%rowtype;
  v_accepted jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_count int;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_domain not in (
    'reading', 'highlights', 'collections', 'mistakes', 'glossary_study', 'glossary_sessions',
    'game_records', 'komuz_favorites', 'path_steps', 'listening_history', 'audio_bookmarks', 'weekly_goal'
  ) then raise exception 'INVALID_DOMAIN'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_key := v_item->>'key';
    if v_key is null or char_length(v_key) not between 1 and 300 then continue; end if;
    v_base := coalesce((v_item->>'base_rev')::bigint, 0);
    v_deleted := coalesce((v_item->>'deleted')::boolean, false);
    v_payload := case when v_deleted then null else v_item->'payload' end;
    if not v_deleted and (v_payload is null or jsonb_typeof(v_payload) <> 'object' or pg_column_size(v_payload) > 65536) then continue; end if;

    select * into v_row from public.user_state_records
      where user_id = v_user_id and domain = p_domain and record_key = v_key
      for update;

    if not found then
      if v_deleted then
        -- Nothing to delete: already in the requested state.
        v_accepted := v_accepted || jsonb_build_object('key', v_key, 'rev', 0, 'deleted', true, 'payload', null);
        continue;
      end if;
      select count(*) into v_count from public.user_state_records where user_id = v_user_id and domain = p_domain;
      if v_count >= 5000 then raise exception 'LIMIT_REACHED'; end if;
      insert into public.user_state_records (user_id, domain, record_key, payload, deleted, rev)
        values (v_user_id, p_domain, v_key, v_payload, false, 1)
        on conflict (user_id, domain, record_key) do nothing
        returning * into v_row;
      if not found then
        -- Inserted by a parallel call a moment ago: report it as a conflict.
        select * into v_row from public.user_state_records where user_id = v_user_id and domain = p_domain and record_key = v_key;
        v_conflicts := v_conflicts || jsonb_build_object('key', v_key, 'rev', v_row.rev, 'deleted', v_row.deleted, 'payload', v_row.payload);
      else
        v_accepted := v_accepted || jsonb_build_object('key', v_key, 'rev', v_row.rev, 'deleted', v_row.deleted, 'payload', v_row.payload);
      end if;
    elsif v_row.rev <> v_base then
      v_conflicts := v_conflicts || jsonb_build_object('key', v_key, 'rev', v_row.rev, 'deleted', v_row.deleted, 'payload', v_row.payload);
    else
      update public.user_state_records
        set payload = v_payload, deleted = v_deleted, rev = v_row.rev + 1, updated_at = now()
        where user_id = v_user_id and domain = p_domain and record_key = v_key
        returning * into v_row;
      v_accepted := v_accepted || jsonb_build_object('key', v_key, 'rev', v_row.rev, 'deleted', v_row.deleted, 'payload', v_row.payload);
    end if;
  end loop;

  return jsonb_build_object('accepted', v_accepted, 'conflicts', v_conflicts);
end;
$$;

revoke all on function public.push_user_state(text, jsonb) from public, anon;
grant execute on function public.push_user_state(text, jsonb) to authenticated;
