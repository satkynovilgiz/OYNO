-- Admin Safe Publishing: RU/EN translations join the revision transaction.
--
-- Before: inside the Culture item/material editor, each RU/EN field saved
-- straight to content_translations (admin_upsert_content_translation), so a
-- translation could go public before Publish and was not part of the same
-- transaction as the Kyrgyz edit.
--
-- After:
--   draft    -> content_drafts.translations holds the editor's full desired
--               RU/EN set next to the canonical fields (never public).
--   publish  -> admin_publish_content(..., p_translations) validates fields
--               AND translations, updates the live row, REPLACES the
--               content's translations, writes the immutable revision,
--               clears the draft and audits - one function, one
--               transaction. The revision number guards translation edits
--               exactly like field edits.
--   rollback -> unchanged contract (already restored translations); now
--               also follows the What's New rule below.
--   direct   -> admin_upsert/delete_content_translation refuse culture_item
--               and culture_material, so nothing can bypass the revision
--               history. Explore destinations and quests keep direct save.
--
-- What's New: the existing policy is "content_updated_at moves only when
-- reader-visible authored text changes on publish". A translation is
-- reader-visible only once REVIEWED, so a publish/restore that changes the
-- reviewed RU/EN set counts as a content update; a draft-status-only change
-- does not, and draft saves never touch the live tables at all.

-- ---------------------------------------------------------------------
-- Draft storage
-- ---------------------------------------------------------------------
alter table public.content_drafts add column if not exists translations jsonb
  check (translations is null or (jsonb_typeof(translations) = 'array' and pg_column_size(translations) < 400000));

-- ---------------------------------------------------------------------
-- Translation rules (internal; not granted to clients)
-- ---------------------------------------------------------------------
create or replace function public.content_translatable_fields(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'culture_item' then array['title', 'alt_names', 'origin', 'history', 'cultural_meaning', 'when_used', 'ingredients',
      'traditional_method', 'who_participates', 'objects_used', 'regional_notes', 'modern_status', 'fun_facts']
    when 'culture_material' then array['title', 'description', 'body']
    else null end;
$$;

-- Returns NULL when the set is acceptable. p_for_publish = false is the
-- draft check: shape, languages, fields and bounds only (a draft may hold an
-- empty, unfinished value). p_for_publish = true also requires every value
-- to be non-empty - the table never stores an empty translation.
create or replace function public.content_translations_problem(p_type text, p_translations jsonb, p_for_publish boolean)
returns text
language plpgsql
immutable
as $$
declare
  v_allowed text[] := public.content_translatable_fields(p_type);
  v_entry jsonb;
  v_seen text[] := '{}';
  v_key text;
begin
  if v_allowed is null then return 'unsupported_content'; end if;
  if p_translations is null then return null; end if;
  if jsonb_typeof(p_translations) <> 'array' then return 'invalid_translations'; end if;
  if jsonb_array_length(p_translations) > 60 then return 'too_many_translations'; end if;
  for v_entry in select * from jsonb_array_elements(p_translations) loop
    if jsonb_typeof(v_entry) <> 'object' or jsonb_typeof(v_entry->'value') <> 'string' then return 'invalid_translation'; end if;
    if coalesce(v_entry->>'language', '') not in ('ru', 'en') then return 'translation_language'; end if;
    if not (coalesce(v_entry->>'field', '') = any(v_allowed)) then return 'translation_field:' || coalesce(v_entry->>'field', ''); end if;
    if coalesce(v_entry->>'status', '') not in ('draft', 'reviewed') then return 'translation_status'; end if;
    if char_length(v_entry->>'value') > 20000 then return 'translation_too_long'; end if;
    if p_for_publish and btrim(v_entry->>'value') = '' then return 'translation_empty:' || (v_entry->>'language') || '.' || (v_entry->>'field'); end if;
    v_key := (v_entry->>'language') || '|' || (v_entry->>'field');
    if v_key = any(v_seen) then return 'translation_duplicate'; end if;
    v_seen := v_seen || v_key;
  end loop;
  return null;
end;
$$;

-- The reader-visible part of a snapshot's translations (reviewed only).
create or replace function public.content_reviewed_translations(p_snapshot jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_array(t->>'language', t->>'field', t->>'value') order by t->>'language', t->>'field'), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_snapshot->'translations', '[]'::jsonb)) t
  where t->>'status' = 'reviewed';
$$;

-- What's New for translation-only changes (see header). Field changes keep
-- going through the existing touch_culture_*_content triggers.
create or replace function public.content_touch_for_translations(p_type text, p_id text, p_before jsonb, p_after jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_before is null then return; end if;
  if public.content_reviewed_translations(p_before) is not distinct from public.content_reviewed_translations(p_after) then return; end if;
  if p_type = 'culture_item' then
    update public.culture_items set content_updated_at = now() where id = p_id;
  elsif p_type = 'culture_material' then
    update public.culture_materials set content_updated_at = now() where id = p_id;
  end if;
end;
$$;
revoke all on function public.content_touch_for_translations(text, text, jsonb, jsonb) from public, anon, authenticated;

-- Replaces a content's live translations with the given (validated) set.
create or replace function public.content_replace_translations(p_type text, p_id text, p_translations jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.content_translations where content_type = p_type and content_id = p_id;
  insert into public.content_translations (content_type, content_id, language, field, value, status, updated_at)
  select p_type, p_id, t->>'language', t->>'field', btrim(t->>'value'), t->>'status', now()
  from jsonb_array_elements(coalesce(p_translations, '[]'::jsonb)) t;
end;
$$;
revoke all on function public.content_replace_translations(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Draft RPCs: fields + translations together
-- ---------------------------------------------------------------------
drop function if exists public.admin_save_content_draft(text, text, jsonb, int);
create or replace function public.admin_save_content_draft(p_content_type text, p_content_id text, p_fields jsonb, p_base_revision int, p_translations jsonb default null)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_at timestamptz := now();
  v_key text;
  v_problem text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type not in ('culture_item', 'culture_material') then raise exception 'UNSUPPORTED_CONTENT'; end if;
  if p_content_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' then raise exception 'INVALID_ID'; end if;
  if jsonb_typeof(p_fields) <> 'object' then raise exception 'INVALID_FIELDS'; end if;
  -- Drafts may be incomplete, but only known authored fields are kept.
  for v_key in select jsonb_object_keys(p_fields) loop
    if not (v_key = any(public.content_allowed_fields(p_content_type))) then raise exception 'UNSUPPORTED_FIELD'; end if;
  end loop;
  v_problem := public.content_translations_problem(p_content_type, p_translations, false);
  if v_problem is not null then raise exception 'VALIDATION:%', v_problem; end if;
  insert into public.content_drafts (content_type, content_id, fields, translations, base_revision, updated_by, updated_at)
  values (p_content_type, p_content_id, p_fields, p_translations, greatest(coalesce(p_base_revision, 0), 0), auth.uid(), v_at)
  on conflict (content_type, content_id) do update set fields = excluded.fields, translations = excluded.translations, base_revision = excluded.base_revision, updated_by = auth.uid(), updated_at = v_at;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, after)
  values (auth.uid(), 'draft_saved', 'content_drafts', p_content_type || ':' || p_content_id, jsonb_build_object('base_revision', p_base_revision, 'has_translations', p_translations is not null));
  return v_at;
end;
$$;
grant execute on function public.admin_save_content_draft(text, text, jsonb, int, jsonb) to authenticated;

-- Return type changes (adds translations), so drop + create.
drop function if exists public.admin_get_content_draft(text, text);
create or replace function public.admin_get_content_draft(p_content_type text, p_content_id text)
returns table (fields jsonb, translations jsonb, base_revision int, updated_at timestamptz, is_mine boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query select d.fields, d.translations, d.base_revision, d.updated_at, d.updated_by = auth.uid()
  from public.content_drafts d where d.content_type = p_content_type and d.content_id = p_content_id;
end;
$$;
grant execute on function public.admin_get_content_draft(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Publish: validate fields + translations -> live row -> translations ->
-- immutable revision -> clear draft -> audit. One transaction.
-- p_translations = the content's complete RU/EN set after publish; NULL
-- leaves the live translations untouched (canonical-only publish).
-- ---------------------------------------------------------------------
drop function if exists public.admin_publish_content(text, text, jsonb, int);
create or replace function public.admin_publish_content(p_content_type text, p_content_id text, p_fields jsonb, p_expected_revision int, p_translations jsonb default null)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_current int;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_problem text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type not in ('culture_item', 'culture_material') then raise exception 'UNSUPPORTED_CONTENT'; end if;
  if p_content_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' then raise exception 'INVALID_ID'; end if;
  -- Serialize publishes of the same content.
  perform pg_advisory_xact_lock(hashtext('content_revision:' || p_content_type || ':' || p_content_id));

  v_current := public.content_current_revision(p_content_type, p_content_id);
  if p_expected_revision is null or v_current <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;

  v_problem := public.content_fields_problem(p_content_type, p_fields);
  if v_problem is not null then raise exception 'VALIDATION:%', v_problem; end if;
  v_problem := public.content_translations_problem(p_content_type, p_translations, true);
  if v_problem is not null then raise exception 'VALIDATION:%', v_problem; end if;

  v_before := public.content_authored_snapshot(p_content_type, p_content_id);
  -- Content that existed before revision history: keep its pre-edit state as revision 1.
  if v_current = 0 and v_before is not null then
    insert into public.content_revisions (content_type, content_id, revision_number, action, snapshot, changed_fields, changed_by)
    values (p_content_type, p_content_id, 1, 'baseline', v_before, '{}', auth.uid());
    v_current := 1;
  end if;

  perform public.content_apply_fields(p_content_type, p_content_id, p_fields);
  if p_translations is not null then perform public.content_replace_translations(p_content_type, p_content_id, p_translations); end if;
  v_after := public.content_authored_snapshot(p_content_type, p_content_id);
  v_changed := public.content_changed_fields(v_before, v_after);
  if v_before is not null and cardinality(v_changed) = 0 then raise exception 'NO_CHANGES'; end if;
  perform public.content_touch_for_translations(p_content_type, p_content_id, v_before, v_after);

  insert into public.content_revisions (content_type, content_id, revision_number, action, snapshot, changed_fields, changed_by)
  values (p_content_type, p_content_id, v_current + 1, 'published', v_after, v_changed, auth.uid());
  delete from public.content_drafts where content_type = p_content_type and content_id = p_content_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'published', case when p_content_type = 'culture_item' then 'culture_items' else 'culture_materials' end, p_content_id, v_before, v_after);
  return v_current + 1;
end;
$$;
grant execute on function public.admin_publish_content(text, text, jsonb, int, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Rollback: same contract as before (fields + sources + verification +
-- translations together, as a NEW revision), now with translation
-- validation and the What's New rule.
-- ---------------------------------------------------------------------
create or replace function public.admin_restore_revision(p_content_type text, p_content_id text, p_revision_number int, p_expected_revision int)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_current int;
  v_target jsonb;
  v_before jsonb;
  v_after jsonb;
  v_problem text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type not in ('culture_item', 'culture_material') then raise exception 'UNSUPPORTED_CONTENT'; end if;
  perform pg_advisory_xact_lock(hashtext('content_revision:' || p_content_type || ':' || p_content_id));

  v_current := public.content_current_revision(p_content_type, p_content_id);
  if p_expected_revision is null or v_current <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
  if p_revision_number = v_current then raise exception 'ALREADY_CURRENT'; end if;
  select snapshot into v_target from public.content_revisions
  where content_type = p_content_type and content_id = p_content_id and revision_number = p_revision_number;
  if v_target is null then raise exception 'NOT_FOUND'; end if;

  v_problem := public.content_fields_problem(p_content_type, v_target->'fields');
  if v_problem is not null then raise exception 'VALIDATION:%', v_problem; end if;
  v_problem := public.content_translations_problem(p_content_type, coalesce(v_target->'translations', '[]'::jsonb), true);
  if v_problem is not null then raise exception 'VALIDATION:%', v_problem; end if;

  v_before := public.content_authored_snapshot(p_content_type, p_content_id);
  perform public.content_apply_fields(p_content_type, p_content_id, v_target->'fields');
  perform public.content_replace_translations(p_content_type, p_content_id, coalesce(v_target->'translations', '[]'::jsonb));
  v_after := public.content_authored_snapshot(p_content_type, p_content_id);
  perform public.content_touch_for_translations(p_content_type, p_content_id, v_before, v_after);

  insert into public.content_revisions (content_type, content_id, revision_number, action, restored_from, snapshot, changed_fields, changed_by)
  values (p_content_type, p_content_id, v_current + 1, 'restored', p_revision_number, v_after, public.content_changed_fields(v_before, v_after), auth.uid());
  delete from public.content_drafts where content_type = p_content_type and content_id = p_content_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'revision_restored', case when p_content_type = 'culture_item' then 'culture_items' else 'culture_materials' end, p_content_id, v_before, v_after);
  return v_current + 1;
end;
$$;
grant execute on function public.admin_restore_revision(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- Legacy direct translation RPCs: still used for Explore destinations and
-- quests; refused for revision-managed content.
-- ---------------------------------------------------------------------
create or replace function public.admin_upsert_content_translation(
  p_content_type text, p_content_id text, p_language text, p_field text, p_value text, p_status text
)
returns public.content_translations
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.content_translations;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type in ('culture_item', 'culture_material') then raise exception 'USE_REVISION_PUBLISH'; end if;
  select to_jsonb(t) into v_before from public.content_translations t
  where content_type = p_content_type and content_id = p_content_id and language = p_language and field = p_field;

  insert into public.content_translations (content_type, content_id, language, field, value, status, updated_at)
  values (p_content_type, p_content_id, p_language, p_field, p_value, coalesce(p_status, 'reviewed'), now())
  on conflict (content_type, content_id, language, field)
  do update set value = excluded.value, status = excluded.status, updated_at = now()
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'content_translations',
          p_content_type || ':' || p_content_id || ':' || p_language || ':' || p_field, v_before, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.admin_delete_content_translation(p_content_type text, p_content_id text, p_language text, p_field text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type in ('culture_item', 'culture_material') then raise exception 'USE_REVISION_PUBLISH'; end if;
  select to_jsonb(t) into v_before from public.content_translations t
  where content_type = p_content_type and content_id = p_content_id and language = p_language and field = p_field;
  delete from public.content_translations
  where content_type = p_content_type and content_id = p_content_id and language = p_language and field = p_field;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'delete', 'content_translations', p_content_type || ':' || p_content_id || ':' || p_language || ':' || p_field, v_before, null);
end;
$$;
