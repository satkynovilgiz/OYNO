-- Phase 6d (slice 2): extends admin_upsert_*/admin_delete_* coverage from
-- Phase 6d slice 1 (culture_categories, culture_materials only) to the
-- rest of the content tables an admin panel needs to manage: explore
-- regions, quests, culture_items (customs/dishes/crafts - the largest
-- table, ~19 editable columns), and culture_quiz_questions. Same shape as
-- slice 1 throughout: SECURITY DEFINER, require_admin_role() gate, before/
-- after audit log row written atomically with the change.
--
-- explore_regions/quests/culture_items already have public-read RLS
-- policies (Phase 6c), so no new read function is needed for those in the
-- admin UI - it can select from them directly like every other screen
-- does. culture_quiz_questions is the one exception: it deliberately has
-- NO public select policy (see 20260829000003_culture_quiz.sql - the
-- answer key must never reach a normal client), so admin needs its own
-- read function that requires the admin role and is allowed to return
-- correct_index.

create function public.admin_upsert_explore_region(
  p_id text, p_kind text, p_name_kg text, p_name_ru text, p_name_en text,
  p_tagline text, p_facts text[], p_status text, p_sort_order int
)
returns public.explore_regions
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.explore_regions;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(r) into v_before from public.explore_regions r where id = p_id;

  insert into public.explore_regions (id, kind, name_kg, name_ru, name_en, tagline, facts, status, sort_order)
  values (p_id, p_kind, p_name_kg, p_name_ru, p_name_en, p_tagline, p_facts, p_status, p_sort_order)
  on conflict (id) do update set
    kind = excluded.kind, name_kg = excluded.name_kg, name_ru = excluded.name_ru, name_en = excluded.name_en,
    tagline = excluded.tagline, facts = excluded.facts, status = excluded.status, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'explore_regions', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_explore_region(text, text, text, text, text, text, text[], text, int) to authenticated;

create function public.admin_delete_explore_region(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(r) into v_before from public.explore_regions r where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.explore_regions where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'explore_regions', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_explore_region(text) to authenticated;

create function public.admin_upsert_quest(
  p_id text, p_character_id text, p_title text, p_subtitle text, p_total_count int, p_cta_label text
)
returns public.quests
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.quests;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(q) into v_before from public.quests q where id = p_id;

  insert into public.quests (id, character_id, title, subtitle, total_count, cta_label)
  values (p_id, p_character_id, p_title, p_subtitle, p_total_count, p_cta_label)
  on conflict (id) do update set
    character_id = excluded.character_id, title = excluded.title, subtitle = excluded.subtitle,
    total_count = excluded.total_count, cta_label = excluded.cta_label
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'quests', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_quest(text, text, text, text, int, text) to authenticated;

create function public.admin_delete_quest(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(q) into v_before from public.quests q where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.quests where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'quests', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_quest(text) to authenticated;

create function public.admin_upsert_culture_item(
  p_id text, p_category_id text, p_subgroup text, p_title text, p_alt_names text,
  p_type_label text, p_origin text, p_history text, p_cultural_meaning text, p_when_used text,
  p_ingredients text, p_traditional_method text, p_who_participates text, p_objects_used text,
  p_regional_notes text, p_modern_status text, p_fun_facts text, p_accuracy_level text,
  p_sources text[], p_sort_order int
)
returns public.culture_items
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.culture_items;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(i) into v_before from public.culture_items i where id = p_id;

  insert into public.culture_items (
    id, category_id, subgroup, title, alt_names, type_label, origin, history, cultural_meaning,
    when_used, ingredients, traditional_method, who_participates, objects_used, regional_notes,
    modern_status, fun_facts, accuracy_level, sources, sort_order
  )
  values (
    p_id, p_category_id, p_subgroup, p_title, p_alt_names, p_type_label, p_origin, p_history, p_cultural_meaning,
    p_when_used, p_ingredients, p_traditional_method, p_who_participates, p_objects_used, p_regional_notes,
    p_modern_status, p_fun_facts, p_accuracy_level, p_sources, p_sort_order
  )
  on conflict (id) do update set
    category_id = excluded.category_id, subgroup = excluded.subgroup, title = excluded.title,
    alt_names = excluded.alt_names, type_label = excluded.type_label, origin = excluded.origin,
    history = excluded.history, cultural_meaning = excluded.cultural_meaning, when_used = excluded.when_used,
    ingredients = excluded.ingredients, traditional_method = excluded.traditional_method,
    who_participates = excluded.who_participates, objects_used = excluded.objects_used,
    regional_notes = excluded.regional_notes, modern_status = excluded.modern_status,
    fun_facts = excluded.fun_facts, accuracy_level = excluded.accuracy_level,
    sources = excluded.sources, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'culture_items', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_culture_item(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[], int
) to authenticated;

create function public.admin_delete_culture_item(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(i) into v_before from public.culture_items i where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.culture_items where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'culture_items', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_culture_item(text) to authenticated;

-- Admin-only read of quiz questions, correct_index included - the public
-- get_quiz_questions() function deliberately strips it (see
-- 20260829000003_culture_quiz.sql); this is the one legitimate place it
-- should be visible, gated by the same require_admin_role() check as
-- every other admin action.
create function public.admin_get_quiz_questions()
returns setof public.culture_quiz_questions
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query select * from public.culture_quiz_questions order by sort_order;
end;
$$;
grant execute on function public.admin_get_quiz_questions() to authenticated;

create function public.admin_upsert_quiz_question(
  p_id text, p_question text, p_choices text[], p_correct_index int, p_source_region_id text, p_sort_order int
)
returns public.culture_quiz_questions
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.culture_quiz_questions;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(q) into v_before from public.culture_quiz_questions q where id = p_id;

  insert into public.culture_quiz_questions (id, question, choices, correct_index, source_region_id, sort_order)
  values (p_id, p_question, p_choices, p_correct_index, p_source_region_id, p_sort_order)
  on conflict (id) do update set
    question = excluded.question, choices = excluded.choices, correct_index = excluded.correct_index,
    source_region_id = excluded.source_region_id, sort_order = excluded.sort_order
  returning * into v_row;

  -- Audit log only, deliberately excludes correct_index from `after` in
  -- spirit (it's stored as the actual row anyway since jsonb captures the
  -- whole row) - the audit log is admin-only reading like this function,
  -- so that's consistent, not a leak to a normal client.
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'culture_quiz_questions', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_quiz_question(text, text, text[], int, text, int) to authenticated;

create function public.admin_delete_quiz_question(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(q) into v_before from public.culture_quiz_questions q where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.culture_quiz_questions where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'culture_quiz_questions', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_quiz_question(text) to authenticated;
