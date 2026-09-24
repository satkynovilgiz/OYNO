-- Journal photos become IMMUTABLE, VERSIONED objects.
--
-- Before: one mutable object per entry, "<user id>/<entry id>.jpg" - an
-- older offline device could upload later and replace the photo that a
-- NEWER version of the same entry references.
-- Now:    "<user id>/<entry id>/<version id>.jpg" - every picked picture is
-- a new object; a record references exactly one version; nothing is ever
-- overwritten. (Client: src/services/journal/journalPhotos.ts.)
--
-- Compatibility: records and objects written with the legacy path keep
-- working - they can still be read (the select policy is unchanged) and a
-- record may still reference its own legacy object. New writes from the
-- app use versioned paths only; the storage insert policy below only
-- accepts versioned paths, and replacing an existing object is no longer
-- allowed for anyone.
--
-- This migration only replaces a function and storage policies; it does
-- not change or drop any table data.

-- A record may reference only a photo inside ITS OWN entry folder (or its
-- own legacy object), in the caller's own folder.
create or replace function public.merge_journal_entries(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_id uuid;
  v_updated timestamptz;
  v_photo text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_id := (v_item->>'id')::uuid;
    v_updated := least((v_item->>'updated_at')::timestamptz, now() + interval '5 minutes');
    v_photo := v_item->>'photo_path';
    if v_photo is not null
       and v_photo !~ ('^' || v_user_id::text || '/' || v_id::text || '/[0-9a-f-]{36}\.jpg$')
       and v_photo <> (v_user_id::text || '/' || v_id::text || '.jpg') then
      v_photo := null;
    end if;

    insert into public.user_journal_entries as j (
      user_id, id, title, note, memory_date, link_type, link_id, link_label, photo_path, created_at, updated_at, deleted_at
    ) values (
      v_user_id,
      v_id,
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
    -- Only a strictly newer version of the entry replaces the stored one,
    -- so a stale device can't re-point an entry at an older photo.
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

-- Uploads: versioned paths only, in the caller's own folder.
drop policy if exists "journal photos: owner uploads" on storage.objects;
create policy "journal photos: owner uploads versions"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  );

-- Immutable: an existing object can never be replaced (not even by its owner).
drop policy if exists "journal photos: owner replaces" on storage.objects;

-- Read and delete stay owner-only (unchanged from 20260923000003_journal.sql).
