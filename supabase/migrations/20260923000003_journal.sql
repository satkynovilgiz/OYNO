-- "My Kyrgyzstan Journal": private memories, reflections and photos a
-- signed-in user keeps about places and cultural discoveries. Uses the
-- same account-sync model as 20260923000001_account_sync.sql (client
-- outbox -> merge RPC -> merged rows back).
--
-- PRIVATE BY DEFAULT AND ONLY:
--   * RLS: a user can read only their own rows; there is no public view,
--     no policy for other users, nothing joins this into search/content;
--   * writes only through merge_journal_entries() (auth.uid(), never a
--     client-supplied user id);
--   * photos live in a PRIVATE bucket under "<user id>/", readable and
--     writable only by that same user (signed URLs for display).
--
-- Merge rule (ambiguous mutable content -> most recent real record wins):
--   per entry id, the version with the later updated_at wins as a whole;
--   a deletion is a tombstone (deleted_at set) and wins over any edit that
--   is not newer than it, so a delete on one phone isn't undone by a stale
--   copy on another.

create table public.user_journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  title text not null default '' check (char_length(title) <= 120),
  note text not null default '' check (char_length(note) <= 4000),
  memory_date date not null,
  link_type text check (link_type is null or link_type in ('nature_site', 'culture_item', 'collection', 'trail')),
  link_id text check (link_id is null or link_id ~ '^[a-z0-9-]{1,80}$'),
  link_label text check (link_label is null or char_length(link_label) <= 160),
  photo_path text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id),
  check ((link_type is null) = (link_id is null))
);

alter table public.user_journal_entries enable row level security;
create policy "select own journal entries" on public.user_journal_entries for select using (auth.uid() = user_id);

-- p_items: [{ id, title, note, memory_date, link_type, link_id, link_label,
--             photo_path, created_at, updated_at, deleted_at }, ...]
-- Returns every journal row of the caller (tombstones included, so other
-- devices learn about deletions).
create function public.merge_journal_entries(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_updated timestamptz;
  v_photo text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_updated := least((v_item->>'updated_at')::timestamptz, now() + interval '5 minutes');
    v_photo := v_item->>'photo_path';
    -- A photo reference must point into the caller's own folder.
    if v_photo is not null and v_photo !~ ('^' || v_user_id::text || '/[0-9a-f-]{36}\.jpg$') then v_photo := null; end if;

    insert into public.user_journal_entries as j (
      user_id, id, title, note, memory_date, link_type, link_id, link_label, photo_path, created_at, updated_at, deleted_at
    ) values (
      v_user_id,
      (v_item->>'id')::uuid,
      left(coalesce(v_item->>'title', ''), 120),
      left(coalesce(v_item->>'note', ''), 4000),
      (v_item->>'memory_date')::date,
      v_item->>'link_type',
      v_item->>'link_id',
      left(v_item->>'link_label', 160),
      v_photo,
      least(coalesce((v_item->>'created_at')::timestamptz, v_updated), v_updated),
      v_updated,
      (v_item->>'deleted_at')::timestamptz
    )
    on conflict (user_id, id) do update set
      title = excluded.title,
      note = excluded.note,
      memory_date = excluded.memory_date,
      link_type = excluded.link_type,
      link_id = excluded.link_id,
      link_label = excluded.link_label,
      photo_path = excluded.photo_path,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
    where excluded.updated_at > j.updated_at;
  end loop;

  return coalesce(
    (select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'note', note, 'memory_date', memory_date, 'link_type', link_type,
        'link_id', link_id, 'link_label', link_label, 'photo_path', photo_path,
        'created_at', created_at, 'updated_at', updated_at, 'deleted_at', deleted_at) order by memory_date desc)
     from public.user_journal_entries where user_id = v_user_id),
    '[]'::jsonb
  );
end;
$$;
grant execute on function public.merge_journal_entries(jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-photos', 'journal-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

create policy "journal photos: owner reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "journal photos: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "journal photos: owner replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "journal photos: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
