-- Long-form content localization (RU / EN) without duplicating rows and
-- without touching the Kyrgyz source.
--
-- Before: culture_items (13 long-form text fields + title), culture_materials
-- (title/description/body), explore_regions.facts and quests (title/subtitle/
-- cta_label) are single-language Kyrgyz columns. Only name_kg/ru/en,
-- discoveries.title_*, quest_steps.title_* and culture_items.simple_summary_*
-- were already per-language.
--
-- After: one translation table keyed by (content_type, content_id, language,
-- field). The original row stays the canonical Kyrgyz text; the app resolves
-- requested language -> Kyrgyz, and knows when it fell back. Explore facts
-- are addressed as field 'fact.<index>'.

create table public.content_translations (
  content_type text not null check (content_type in ('culture_item', 'culture_material', 'explore_region', 'quest')),
  content_id text not null,
  language text not null check (language in ('ru', 'en')),
  field text not null check (char_length(field) between 1 and 40),
  value text not null check (char_length(value) between 1 and 20000),
  -- Only reviewed translations are readable by the app; drafts stay hidden.
  status text not null default 'reviewed' check (status in ('draft', 'reviewed')),
  updated_at timestamptz not null default now(),
  primary key (content_type, content_id, language, field)
);

alter table public.content_translations enable row level security;
create policy "select reviewed content translations" on public.content_translations for select using (status = 'reviewed');

create function public.admin_upsert_content_translation(
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
grant execute on function public.admin_upsert_content_translation(text, text, text, text, text, text) to authenticated;

create function public.admin_delete_content_translation(p_content_type text, p_content_id text, p_language text, p_field text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(t) into v_before from public.content_translations t
  where content_type = p_content_type and content_id = p_content_id and language = p_language and field = p_field;
  delete from public.content_translations
  where content_type = p_content_type and content_id = p_content_id and language = p_language and field = p_field;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'delete', 'content_translations', p_content_type || ':' || p_content_id || ':' || p_language || ':' || p_field, v_before, null);
end;
$$;
grant execute on function public.admin_delete_content_translation(text, text, text, text) to authenticated;

-- Admin tool support: list every row (drafts included) with a readable
-- composite id, and delete by that id (the generic admin editor passes a
-- single p_id).
create function public.admin_get_content_translations()
returns table (id text, content_type text, content_id text, language text, field text, value text, status text, updated_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query
    select t.content_type || '|' || t.content_id || '|' || t.language || '|' || t.field, t.content_type, t.content_id, t.language, t.field, t.value, t.status, t.updated_at
    from public.content_translations t
    order by t.content_type, t.content_id, t.language, t.field;
end;
$$;
grant execute on function public.admin_get_content_translations() to authenticated;

create function public.admin_delete_content_translation_by_id(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_parts text[] := string_to_array(p_id, '|');
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if array_length(v_parts, 1) <> 4 then raise exception 'BAD_TRANSLATION_ID'; end if;
  perform public.admin_delete_content_translation(v_parts[1], v_parts[2], v_parts[3], v_parts[4]);
end;
$$;
grant execute on function public.admin_delete_content_translation_by_id(text) to authenticated;
