-- Admin Revision History + Safe Publishing 1.0
--
-- Culture items and culture materials get an editorial workflow inside the
-- EXISTING Admin Studio:
--   draft    -> content_drafts (admin-only table; public Culture queries
--               never read it, so a draft can't leak into the app)
--   publish  -> ONE transaction: validate, update the live row, write an
--               immutable revision, clear the draft, audit log
--   history  -> content_revisions, newest first, admin-only
--   rollback -> restores an old snapshot as a NEW revision (history is
--               never rewritten or deleted)
--
-- Identity: changed_by is always auth.uid() inside these functions - the
-- client never sends it. Roles: the existing require_admin_role()
-- (super_admin / content_editor). Normal users have no access at all.
--
-- What's New: content_updated_at is still set ONLY by the existing
-- touch_culture_*_content triggers when an authored field really changes on
-- the live row - i.e. on publish/restore. Draft saves never touch the live
-- row, so they never count as a public update.
--
-- A snapshot holds only the authored state needed to rebuild a version:
-- the authored fields (incl. sources + verification level) and that
-- content's translations. Never tokens, user data, analytics or feedback.
-- Photos (image_url, the media pipeline) are not part of a revision.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('culture_item', 'culture_material')),
  content_id text not null check (content_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  revision_number int not null check (revision_number > 0),
  action text not null check (action in ('baseline', 'published', 'restored')),
  restored_from int check (restored_from is null or restored_from > 0),
  snapshot jsonb not null check (pg_column_size(snapshot) < 400000),
  changed_fields text[] not null default '{}',
  changed_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_type, content_id, revision_number)
);
create index if not exists content_revisions_lookup on public.content_revisions (content_type, content_id, revision_number desc);

create table if not exists public.content_drafts (
  content_type text not null check (content_type in ('culture_item', 'culture_material')),
  content_id text not null check (content_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  fields jsonb not null check (pg_column_size(fields) < 200000),
  base_revision int not null check (base_revision >= 0),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (content_type, content_id)
);

-- RLS: admin/editor read only. No insert/update/delete policies - every
-- write goes through the SECURITY DEFINER functions below.
alter table public.content_revisions enable row level security;
alter table public.content_drafts enable row level security;
drop policy if exists "content editors read revisions" on public.content_revisions;
create policy "content editors read revisions" on public.content_revisions for select
  using (exists (select 1 from public.admin_roles where user_id = auth.uid() and role in ('super_admin', 'content_editor')));
drop policy if exists "content editors read drafts" on public.content_drafts;
create policy "content editors read drafts" on public.content_drafts for select
  using (exists (select 1 from public.admin_roles where user_id = auth.uid() and role in ('super_admin', 'content_editor')));
revoke insert, update, delete on public.content_revisions from anon, authenticated;
revoke insert, update, delete on public.content_drafts from anon, authenticated;

-- Revisions are immutable. The only permitted change is the FK clearing
-- changed_by when an auth user is deleted.
create or replace function public.content_revisions_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then raise exception 'REVISIONS_ARE_IMMUTABLE'; end if;
  if (new.id, new.content_type, new.content_id, new.revision_number, new.action, new.restored_from, new.snapshot, new.changed_fields, new.created_at)
     is distinct from (old.id, old.content_type, old.content_id, old.revision_number, old.action, old.restored_from, old.snapshot, old.changed_fields, old.created_at)
     or new.changed_by is not null and new.changed_by is distinct from old.changed_by then
    raise exception 'REVISIONS_ARE_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists content_revisions_immutable on public.content_revisions;
create trigger content_revisions_immutable before update or delete on public.content_revisions
  for each row execute function public.content_revisions_immutable();

-- ---------------------------------------------------------------------
-- Internal helpers (not granted to clients)
-- ---------------------------------------------------------------------
create or replace function public.content_authored_snapshot(p_type text, p_id text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_fields jsonb;
begin
  if p_type = 'culture_item' then
    select jsonb_build_object(
      'category_id', category_id, 'subgroup', subgroup, 'title', title, 'alt_names', alt_names, 'type_label', type_label,
      'origin', origin, 'history', history, 'cultural_meaning', cultural_meaning, 'when_used', when_used,
      'ingredients', ingredients, 'traditional_method', traditional_method, 'who_participates', who_participates,
      'objects_used', objects_used, 'regional_notes', regional_notes, 'modern_status', modern_status, 'fun_facts', fun_facts,
      'simple_summary_kg', simple_summary_kg, 'simple_summary_ru', simple_summary_ru, 'simple_summary_en', simple_summary_en,
      'accuracy_level', accuracy_level, 'sources', to_jsonb(coalesce(sources, '{}'::text[])), 'sort_order', sort_order)
    into v_fields from public.culture_items where id = p_id;
  elsif p_type = 'culture_material' then
    select jsonb_build_object(
      'kind', kind, 'title', title, 'description', description, 'duration_minutes', duration_minutes, 'sort_order', sort_order,
      'body', body, 'accuracy_level', accuracy_level, 'sources', to_jsonb(coalesce(sources, '{}'::text[])))
    into v_fields from public.culture_materials where id = p_id;
  else
    raise exception 'UNSUPPORTED_CONTENT';
  end if;
  if v_fields is null then return null; end if;
  return jsonb_build_object(
    'fields', v_fields,
    'translations', coalesce((
      select jsonb_agg(jsonb_build_object('language', t.language, 'field', t.field, 'value', t.value, 'status', t.status) order by t.language, t.field)
      from public.content_translations t where t.content_type = p_type and t.content_id = p_id), '[]'::jsonb));
end;
$$;
revoke all on function public.content_authored_snapshot(text, text) from public, anon, authenticated;

-- Authored fields a revision / draft may carry, per content type.
create or replace function public.content_allowed_fields(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'culture_item' then array['category_id', 'subgroup', 'title', 'alt_names', 'type_label', 'origin', 'history', 'cultural_meaning', 'when_used',
      'ingredients', 'traditional_method', 'who_participates', 'objects_used', 'regional_notes', 'modern_status', 'fun_facts',
      'simple_summary_kg', 'simple_summary_ru', 'simple_summary_en', 'accuracy_level', 'sources', 'sort_order']
    when 'culture_material' then array['kind', 'title', 'description', 'duration_minutes', 'sort_order', 'body', 'accuracy_level', 'sources']
    else null end;
$$;

-- Publishing rules: returns NULL when the fields may go live.
create or replace function public.content_fields_problem(p_type text, p_fields jsonb)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_allowed text[];
  v_key text;
  v_source jsonb;
  v_sources jsonb := coalesce(p_fields->'sources', '[]'::jsonb);
  v_level text := coalesce(p_fields->>'accuracy_level', 'unverified');
begin
  if jsonb_typeof(p_fields) <> 'object' then return 'invalid_fields'; end if;
  v_allowed := public.content_allowed_fields(p_type);
  if v_allowed is null then return 'unsupported_content'; end if;
  for v_key in select jsonb_object_keys(p_fields) loop
    if not (v_key = any(v_allowed)) then return 'unsupported_field:' || v_key; end if;
    if jsonb_typeof(p_fields->v_key) = 'string' and char_length(p_fields->>v_key) > 20000 then return 'too_long:' || v_key; end if;
  end loop;
  if coalesce(btrim(p_fields->>'title'), '') = '' then return 'title_required'; end if;
  if char_length(p_fields->>'title') > 300 then return 'title_too_long'; end if;
  if v_level not in ('verified', 'partially_verified', 'unverified') then return 'invalid_verification'; end if;
  if jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) > 30 then return 'invalid_sources'; end if;
  for v_source in select * from jsonb_array_elements(v_sources) loop
    if jsonb_typeof(v_source) <> 'string' or (v_source #>> '{}') !~ '^https?://[^[:space:]]{3,2000}$' then return 'invalid_source_url'; end if;
  end loop;
  if v_level = 'verified' and jsonb_array_length(v_sources) = 0 then return 'verified_needs_sources'; end if;
  if p_type = 'culture_item' and not exists (select 1 from public.culture_categories where id = p_fields->>'category_id') then return 'unknown_category'; end if;
  if p_type = 'culture_material' and coalesce(p_fields->>'kind', '') not in ('today_discovery', 'reading', 'video', 'game') then return 'invalid_kind'; end if;
  return null;
end;
$$;
revoke all on function public.content_fields_problem(text, jsonb) from public, anon, authenticated;

-- Writes authored fields to the live row (insert or update). Keys absent
-- from p_fields keep their current value (e.g. simple summaries edited
-- elsewhere), so publishing never blanks a field it didn't carry.
create or replace function public.content_apply_fields(p_type text, p_id text, p_fields jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_sources text[] := case when p_fields ? 'sources' then array(select jsonb_array_elements_text(p_fields->'sources')) else null end;
begin
  if p_type = 'culture_item' then
    insert into public.culture_items as c (
      id, category_id, subgroup, title, alt_names, type_label, origin, history, cultural_meaning, when_used, ingredients,
      traditional_method, who_participates, objects_used, regional_notes, modern_status, fun_facts,
      simple_summary_kg, simple_summary_ru, simple_summary_en, accuracy_level, sources, sort_order)
    values (
      p_id, p_fields->>'category_id', p_fields->>'subgroup', p_fields->>'title', p_fields->>'alt_names', p_fields->>'type_label',
      p_fields->>'origin', p_fields->>'history', p_fields->>'cultural_meaning', p_fields->>'when_used', p_fields->>'ingredients',
      p_fields->>'traditional_method', p_fields->>'who_participates', p_fields->>'objects_used', p_fields->>'regional_notes',
      p_fields->>'modern_status', p_fields->>'fun_facts', p_fields->>'simple_summary_kg', p_fields->>'simple_summary_ru', p_fields->>'simple_summary_en',
      coalesce(p_fields->>'accuracy_level', 'unverified'), coalesce(v_sources, '{}'::text[]), coalesce((p_fields->>'sort_order')::int, 0))
    on conflict (id) do update set
      category_id = case when p_fields ? 'category_id' then excluded.category_id else c.category_id end,
      subgroup = case when p_fields ? 'subgroup' then excluded.subgroup else c.subgroup end,
      title = excluded.title,
      alt_names = case when p_fields ? 'alt_names' then excluded.alt_names else c.alt_names end,
      type_label = case when p_fields ? 'type_label' then excluded.type_label else c.type_label end,
      origin = case when p_fields ? 'origin' then excluded.origin else c.origin end,
      history = case when p_fields ? 'history' then excluded.history else c.history end,
      cultural_meaning = case when p_fields ? 'cultural_meaning' then excluded.cultural_meaning else c.cultural_meaning end,
      when_used = case when p_fields ? 'when_used' then excluded.when_used else c.when_used end,
      ingredients = case when p_fields ? 'ingredients' then excluded.ingredients else c.ingredients end,
      traditional_method = case when p_fields ? 'traditional_method' then excluded.traditional_method else c.traditional_method end,
      who_participates = case when p_fields ? 'who_participates' then excluded.who_participates else c.who_participates end,
      objects_used = case when p_fields ? 'objects_used' then excluded.objects_used else c.objects_used end,
      regional_notes = case when p_fields ? 'regional_notes' then excluded.regional_notes else c.regional_notes end,
      modern_status = case when p_fields ? 'modern_status' then excluded.modern_status else c.modern_status end,
      fun_facts = case when p_fields ? 'fun_facts' then excluded.fun_facts else c.fun_facts end,
      simple_summary_kg = case when p_fields ? 'simple_summary_kg' then excluded.simple_summary_kg else c.simple_summary_kg end,
      simple_summary_ru = case when p_fields ? 'simple_summary_ru' then excluded.simple_summary_ru else c.simple_summary_ru end,
      simple_summary_en = case when p_fields ? 'simple_summary_en' then excluded.simple_summary_en else c.simple_summary_en end,
      accuracy_level = case when p_fields ? 'accuracy_level' then excluded.accuracy_level else c.accuracy_level end,
      sources = case when p_fields ? 'sources' then excluded.sources else c.sources end,
      sort_order = case when p_fields ? 'sort_order' then excluded.sort_order else c.sort_order end;
  elsif p_type = 'culture_material' then
    insert into public.culture_materials as m (id, kind, title, description, duration_minutes, sort_order, body, accuracy_level, sources)
    values (
      p_id, p_fields->>'kind', p_fields->>'title', p_fields->>'description', (p_fields->>'duration_minutes')::int,
      coalesce((p_fields->>'sort_order')::int, 0), p_fields->>'body', coalesce(p_fields->>'accuracy_level', 'unverified'), coalesce(v_sources, '{}'::text[]))
    on conflict (id) do update set
      kind = case when p_fields ? 'kind' then excluded.kind else m.kind end,
      title = excluded.title,
      description = case when p_fields ? 'description' then excluded.description else m.description end,
      duration_minutes = case when p_fields ? 'duration_minutes' then excluded.duration_minutes else m.duration_minutes end,
      sort_order = case when p_fields ? 'sort_order' then excluded.sort_order else m.sort_order end,
      body = case when p_fields ? 'body' then excluded.body else m.body end,
      accuracy_level = case when p_fields ? 'accuracy_level' then excluded.accuracy_level else m.accuracy_level end,
      sources = case when p_fields ? 'sources' then excluded.sources else m.sources end;
  else
    raise exception 'UNSUPPORTED_CONTENT';
  end if;
end;
$$;
revoke all on function public.content_apply_fields(text, text, jsonb) from public, anon, authenticated;

create or replace function public.content_changed_fields(p_before jsonb, p_after jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(key order by key), '{}'::text[]) from (
    select k as key from jsonb_object_keys(coalesce(p_after->'fields', '{}'::jsonb)) k
    where (p_before->'fields'->k) is distinct from (p_after->'fields'->k)
    union
    select 'translations' where coalesce(p_before->'translations', '[]'::jsonb) is distinct from coalesce(p_after->'translations', '[]'::jsonb)
  ) s;
$$;

create or replace function public.content_current_revision(p_type text, p_id text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce(max(revision_number), 0) from public.content_revisions where content_type = p_type and content_id = p_id;
$$;
revoke all on function public.content_current_revision(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------

-- Draft: stored apart from the live row; never visible to the app.
create or replace function public.admin_save_content_draft(p_content_type text, p_content_id text, p_fields jsonb, p_base_revision int)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_at timestamptz := now();
  v_key text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_content_type not in ('culture_item', 'culture_material') then raise exception 'UNSUPPORTED_CONTENT'; end if;
  if p_content_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' then raise exception 'INVALID_ID'; end if;
  if jsonb_typeof(p_fields) <> 'object' then raise exception 'INVALID_FIELDS'; end if;
  -- Drafts may be incomplete, but only known authored fields are kept.
  for v_key in select jsonb_object_keys(p_fields) loop
    if not (v_key = any(public.content_allowed_fields(p_content_type))) then raise exception 'UNSUPPORTED_FIELD'; end if;
  end loop;
  insert into public.content_drafts (content_type, content_id, fields, base_revision, updated_by, updated_at)
  values (p_content_type, p_content_id, p_fields, greatest(coalesce(p_base_revision, 0), 0), auth.uid(), v_at)
  on conflict (content_type, content_id) do update set fields = excluded.fields, base_revision = excluded.base_revision, updated_by = auth.uid(), updated_at = v_at;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, after)
  values (auth.uid(), 'draft_saved', 'content_drafts', p_content_type || ':' || p_content_id, jsonb_build_object('base_revision', p_base_revision));
  return v_at;
end;
$$;
grant execute on function public.admin_save_content_draft(text, text, jsonb, int) to authenticated;

create or replace function public.admin_get_content_draft(p_content_type text, p_content_id text)
returns table (fields jsonb, base_revision int, updated_at timestamptz, is_mine boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query select d.fields, d.base_revision, d.updated_at, d.updated_by = auth.uid()
  from public.content_drafts d where d.content_type = p_content_type and d.content_id = p_content_id;
end;
$$;
grant execute on function public.admin_get_content_draft(text, text) to authenticated;

create or replace function public.admin_discard_content_draft(p_content_type text, p_content_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  delete from public.content_drafts where content_type = p_content_type and content_id = p_content_id;
end;
$$;
grant execute on function public.admin_discard_content_draft(text, text) to authenticated;

-- Publish: validate -> live row -> immutable revision -> clear draft ->
-- audit. One function = one transaction: any failure rolls ALL of it back.
create or replace function public.admin_publish_content(p_content_type text, p_content_id text, p_fields jsonb, p_expected_revision int)
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

  v_before := public.content_authored_snapshot(p_content_type, p_content_id);
  -- Content that existed before revision history: keep its pre-edit state as revision 1.
  if v_current = 0 and v_before is not null then
    insert into public.content_revisions (content_type, content_id, revision_number, action, snapshot, changed_fields, changed_by)
    values (p_content_type, p_content_id, 1, 'baseline', v_before, '{}', auth.uid());
    v_current := 1;
  end if;

  perform public.content_apply_fields(p_content_type, p_content_id, p_fields);
  v_after := public.content_authored_snapshot(p_content_type, p_content_id);
  v_changed := public.content_changed_fields(v_before, v_after);
  if v_before is not null and cardinality(v_changed) = 0 then raise exception 'NO_CHANGES'; end if;

  insert into public.content_revisions (content_type, content_id, revision_number, action, snapshot, changed_fields, changed_by)
  values (p_content_type, p_content_id, v_current + 1, 'published', v_after, v_changed, auth.uid());
  delete from public.content_drafts where content_type = p_content_type and content_id = p_content_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'published', case when p_content_type = 'culture_item' then 'culture_items' else 'culture_materials' end, p_content_id, v_before, v_after);
  return v_current + 1;
end;
$$;
grant execute on function public.admin_publish_content(text, text, jsonb, int) to authenticated;

-- Rollback: the old snapshot (fields incl. sources + verification, and its
-- translations) becomes the live state as a NEW revision.
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

  v_before := public.content_authored_snapshot(p_content_type, p_content_id);
  perform public.content_apply_fields(p_content_type, p_content_id, v_target->'fields');
  delete from public.content_translations where content_type = p_content_type and content_id = p_content_id;
  insert into public.content_translations (content_type, content_id, language, field, value, status, updated_at)
  select p_content_type, p_content_id, t->>'language', t->>'field', t->>'value', coalesce(t->>'status', 'reviewed'), now()
  from jsonb_array_elements(coalesce(v_target->'translations', '[]'::jsonb)) t;
  v_after := public.content_authored_snapshot(p_content_type, p_content_id);

  insert into public.content_revisions (content_type, content_id, revision_number, action, restored_from, snapshot, changed_fields, changed_by)
  values (p_content_type, p_content_id, v_current + 1, 'restored', p_revision_number, v_after, public.content_changed_fields(v_before, v_after), auth.uid());
  delete from public.content_drafts where content_type = p_content_type and content_id = p_content_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'revision_restored', case when p_content_type = 'culture_item' then 'culture_items' else 'culture_materials' end, p_content_id, v_before, v_after);
  return v_current + 1;
end;
$$;
grant execute on function public.admin_restore_revision(text, text, int, int) to authenticated;

-- History list: editor shown in admin-safe form (their role, or "you") -
-- never an email or account id.
create or replace function public.admin_list_content_revisions(p_content_type text, p_content_id text)
returns table (revision_number int, action text, restored_from int, changed_fields text[], created_at timestamptz, editor_role text, is_mine boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query
    select r.revision_number, r.action, r.restored_from, r.changed_fields, r.created_at,
           (select ar.role from public.admin_roles ar where ar.user_id = r.changed_by), r.changed_by = auth.uid()
    from public.content_revisions r
    where r.content_type = p_content_type and r.content_id = p_content_id
    order by r.revision_number desc
    limit 200;
end;
$$;
grant execute on function public.admin_list_content_revisions(text, text) to authenticated;

create or replace function public.admin_get_content_revision(p_content_type text, p_content_id text, p_revision_number int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select snapshot into v_snapshot from public.content_revisions
  where content_type = p_content_type and content_id = p_content_id and revision_number = p_revision_number;
  if v_snapshot is null then raise exception 'NOT_FOUND'; end if;
  return v_snapshot;
end;
$$;
grant execute on function public.admin_get_content_revision(text, text, int) to authenticated;
