-- Cultural sources + verification (trust layer).
--
-- 1. explore_regions had a verification status but no sources at all -
--    the citations lived only in content/explore/*.md. Add the column and
--    seed it from those research notes (the same URLs, nothing invented).
-- 2. "verified" now requires at least one listed source, enforced for every
--    future write on each table that carries a status (NOT VALID: existing
--    rows are checked by the audit, not rewritten here).
-- 3. Destinations whose facts contain a claim awaiting human verification
--    (docs/CONTENT_AUDIT.md §5) move from "verified" to "partially_verified".
--    This does not resolve any claim - it stops the app from overstating
--    how far the review has gone. Idempotent.
-- 4. Editor notes live in an admin-only table (never readable by the app).

alter table public.explore_regions add column if not exists sources text[];

update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7_%D0%90%D0%BB%D0%B0-%D0%A2%D0%BE%D0%BE%D1%81%D1%83']::text[] where id = 'ala-too' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%90%D0%BB%D0%B0%D0%B9_%D1%80%D0%B0%D0%B9%D0%BE%D0%BD%D1%83', 'https://encyclopedia.edu.kg/KyrgWiki/index.php?title=%D0%90%D0%9B%D0%90%D0%99_%D3%A8%D0%A0%D3%A8%D3%A8%D0%9D%D2%AE']::text[] where id = 'alay' and sources is null;
update public.explore_regions set sources = array['https://ru.wikipedia.org/wiki/%D0%90%D1%80%D1%81%D0%BB%D0%B0%D0%BD%D0%B1%D0%BE%D0%B1', 'https://wikiway.com/kyrgyzstan/arslanbob/']::text[] where id = 'arslanbob' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%91%D0%B0%D1%82%D0%BA%D0%B5%D0%BD_%D0%BE%D0%B1%D0%BB%D1%83%D1%81%D1%83']::text[] where id = 'batken' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%91%D0%B8%D1%88%D0%BA%D0%B5%D0%BA', 'https://www.azattyk.org/a/kyrgyzstan-bishkek-pishpek-frunze/30582960.html', 'https://www.bishkek.gov.kg/ky/history']::text[] where id = 'bishkek' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%A7%D2%AF%D0%B9_%D0%BE%D0%B1%D0%BB%D1%83%D1%81%D1%83', 'https://maalymat.kg/ky/wiki/chuiskaya-oblast']::text[] where id = 'chuy' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%96%D0%B0%D0%BB%D0%B0%D0%BB-%D0%90%D0%B1%D0%B0%D0%B4_%D0%BE%D0%B1%D0%BB%D1%83%D1%81%D1%83']::text[] where id = 'jalal-abad' and sources is null;
update public.explore_regions set sources = array['https://www.naryn.gov.kg/ky/information/naryn-oblusu/', 'https://ky.wikipedia.org/wiki/%D0%9D%D0%B0%D1%80%D1%8B%D0%BD_%D0%BE%D0%B1%D0%BB%D1%83%D1%81%D1%83']::text[] where id = 'naryn' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%9E%D1%88']::text[] where id = 'osh' and sources is null;
update public.explore_regions set sources = array['https://kogart.kg/?id_news=8157&view=news', 'https://jalal-abadobl.gov.kg/?p=2001']::text[] where id = 'sary-chelek' and sources is null;
update public.explore_regions set sources = array['https://ru.wikijournal.org/wiki/%D0%A1%D0%BE%D0%BD-%D0%9A%D1%83%D0%BB%D1%8C', 'https://www.centralasia-travel.com/ru/countries/kirgistan/sights/son-kul']::text[] where id = 'son-kol' and sources is null;
update public.explore_regions set sources = array['https://ky.wikipedia.org/wiki/%D0%A1%D1%83%D1%83%D1%81%D0%B0%D0%BC%D1%8B%D1%80_%D3%A9%D1%80%D3%A9%D3%A9%D0%BD%D2%AF']::text[] where id = 'suusamyr' and sources is null;
update public.explore_regions set sources = array['https://ru.wikipedia.org/wiki/%D0%9C%D0%B0%D0%BD%D0%B0%D1%81', 'https://znanierussia.ru/articles/%D0%9C%D0%B0%D0%BD%D0%B0%D1%81']::text[] where id = 'talas' and sources is null;
update public.explore_regions set sources = array['https://ru.wikipedia.org/wiki/%D0%98%D1%81%D1%81%D1%8B%D0%BA-%D0%9A%D1%83%D0%BB%D1%8C', 'https://www.cawater-info.net/bk/1-1-2-1-issyk-kul.htm']::text[] where id = 'ysyk-kol' and sources is null;

update public.explore_regions set status = 'partially_verified'
where status = 'verified' and id in ('son-kol', 'ysyk-kol', 'sary-chelek', 'arslanbob', 'talas', 'bishkek', 'batken', 'ala-too', 'alay');

alter table public.culture_items add constraint culture_items_verified_needs_sources
  check (accuracy_level <> 'verified' or coalesce(array_length(sources, 1), 0) > 0) not valid;
alter table public.culture_materials add constraint culture_materials_verified_needs_sources
  check (accuracy_level <> 'verified' or coalesce(array_length(sources, 1), 0) > 0) not valid;
alter table public.discoveries add constraint discoveries_verified_needs_sources
  check (accuracy_level <> 'verified' or coalesce(array_length(sources, 1), 0) > 0) not valid;
alter table public.explore_regions add constraint explore_regions_verified_needs_sources
  check (status <> 'verified' or coalesce(array_length(sources, 1), 0) > 0) not valid;

create function public.admin_upsert_explore_region(
  p_id text, p_kind text, p_name_kg text, p_name_ru text, p_name_en text,
  p_tagline text, p_facts text[], p_status text, p_sort_order int, p_sources text[]
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

  insert into public.explore_regions (id, kind, name_kg, name_ru, name_en, tagline, facts, status, sort_order, sources)
  values (p_id, p_kind, p_name_kg, p_name_ru, p_name_en, p_tagline, p_facts, p_status, p_sort_order, p_sources)
  on conflict (id) do update set
    kind = excluded.kind, name_kg = excluded.name_kg, name_ru = excluded.name_ru, name_en = excluded.name_en,
    tagline = excluded.tagline, facts = excluded.facts, status = excluded.status, sort_order = excluded.sort_order,
    sources = excluded.sources
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'explore_regions', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_explore_region(text, text, text, text, text, text, text[], text, int, text[]) to authenticated;

create table public.content_review_notes (
  content_type text not null check (content_type in ('culture_item', 'culture_material', 'explore_region', 'discovery')),
  content_id text not null,
  note text not null check (char_length(note) between 1 and 4000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (content_type, content_id)
);
-- RLS on, and deliberately NO select policy: notes are for editors only
-- and are read through the admin function below.
alter table public.content_review_notes enable row level security;

create function public.admin_get_content_review_notes()
returns table (id text, content_type text, content_id text, note text, updated_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  return query
    select n.content_type || '|' || n.content_id, n.content_type, n.content_id, n.note, n.updated_at
    from public.content_review_notes n order by n.content_type, n.content_id;
end;
$$;
grant execute on function public.admin_get_content_review_notes() to authenticated;

create function public.admin_upsert_content_review_note(p_content_type text, p_content_id text, p_note text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  insert into public.content_review_notes (content_type, content_id, note, updated_at, updated_by)
  values (p_content_type, p_content_id, p_note, now(), auth.uid())
  on conflict (content_type, content_id) do update set note = excluded.note, updated_at = now(), updated_by = auth.uid();
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'update', 'content_review_notes', p_content_type || ':' || p_content_id, null, jsonb_build_object('note', p_note));
end;
$$;
grant execute on function public.admin_upsert_content_review_note(text, text, text) to authenticated;

create function public.admin_delete_content_review_note(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_parts text[] := string_to_array(p_id, '|');
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if array_length(v_parts, 1) <> 2 then raise exception 'BAD_NOTE_ID'; end if;
  delete from public.content_review_notes where content_type = v_parts[1] and content_id = v_parts[2];
end;
$$;
grant execute on function public.admin_delete_content_review_note(text) to authenticated;
