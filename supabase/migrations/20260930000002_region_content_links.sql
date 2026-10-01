-- Admin Region Curator 1.0.
--
-- Which EXISTING content appears in each Region Hub becomes editorial data
-- (it was TypeScript-only). Product rules stay in the app: the supported
-- region ids and their order, fallback tones, routes, the progress rules,
-- challenge packs and heroes. When a region has no rows here the app keeps
-- using its built-in links, so nothing changes until an editor saves.
--
--   region_content_links  one row per linked item, ordered by sort_order
--   region_intros         optional per-language intro overrides (KG/RU/EN)
--
-- Both are public content (readable by everyone, like explore_regions);
-- nobody can write them from the app - only through the admin_* functions
-- below, which require a content-editing admin role.

create table public.region_content_links (
  region_id text not null check (region_id in ('chuy', 'talas', 'ysyk-kol', 'naryn', 'jalal-abad', 'osh', 'batken')),
  content_type text not null check (content_type in ('destination', 'discovery', 'culture_item', 'culture_material', 'trail', 'quest')),
  content_id text not null check (content_id ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (region_id, content_type, content_id)
);

alter table public.region_content_links enable row level security;
create policy "read region content links" on public.region_content_links for select using (true);
-- updated_by is editor bookkeeping - never exposed to the app. (A column
-- revoke alone doesn't beat Supabase's table-level grant, so the table
-- grant is replaced by a grant on the public columns only.)
revoke select on public.region_content_links from anon, authenticated;
grant select (region_id, content_type, content_id, sort_order, created_at, updated_at) on public.region_content_links to anon, authenticated;

create table public.region_intros (
  region_id text not null check (region_id in ('chuy', 'talas', 'ysyk-kol', 'naryn', 'jalal-abad', 'osh', 'batken')),
  language text not null check (language in ('kg', 'ru', 'en')),
  intro text not null check (char_length(btrim(intro)) between 1 and 300 and intro !~ '[<>{}]'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (region_id, language)
);

alter table public.region_intros enable row level security;
create policy "read region intros" on public.region_intros for select using (true);
revoke select on public.region_intros from anon, authenticated;
grant select (region_id, language, intro, updated_at) on public.region_intros to anon, authenticated;

-- Replaces a region's links in one transaction. p_links:
-- [{ "content_type": "...", "content_id": "...", "sort_order": 0 }, ...]
-- Database-backed ids are checked against their tables; trails and guided
-- quests are defined in the app and are checked by the admin screen.
create function public.admin_set_region_links(p_region_id text, p_links jsonb)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_type text;
  v_id text;
  v_count integer := 0;
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_region_id not in ('chuy', 'talas', 'ysyk-kol', 'naryn', 'jalal-abad', 'osh', 'batken') then raise exception 'UNKNOWN_REGION'; end if;
  if jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 200 then raise exception 'INVALID_INPUT'; end if;

  for v_item in select * from jsonb_array_elements(p_links) loop
    v_type := v_item->>'content_type';
    v_id := v_item->>'content_id';
    if v_type = 'destination' and not exists (select 1 from public.explore_regions where id = v_id) then raise exception 'BROKEN_LINK: %', v_id; end if;
    if v_type = 'discovery' and not exists (select 1 from public.discoveries where id = v_id) then raise exception 'BROKEN_LINK: %', v_id; end if;
    if v_type = 'culture_item' and not exists (select 1 from public.culture_items where id = v_id) then raise exception 'BROKEN_LINK: %', v_id; end if;
    if v_type = 'culture_material' and not exists (select 1 from public.culture_materials where id = v_id) then raise exception 'BROKEN_LINK: %', v_id; end if;
  end loop;

  if (select count(*) from jsonb_array_elements(p_links)) <> (select count(distinct (e->>'content_type') || '|' || (e->>'content_id')) from jsonb_array_elements(p_links) e) then
    raise exception 'DUPLICATE_LINK';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('content_type', content_type, 'content_id', content_id, 'sort_order', sort_order) order by content_type, sort_order), '[]'::jsonb)
    into v_before from public.region_content_links where region_id = p_region_id;

  delete from public.region_content_links where region_id = p_region_id;
  insert into public.region_content_links (region_id, content_type, content_id, sort_order, updated_by)
  select p_region_id, e->>'content_type', e->>'content_id', coalesce((e->>'sort_order')::int, 0), auth.uid()
  from jsonb_array_elements(p_links) e;
  get diagnostics v_count = row_count;

  -- Same audit trail as every other admin write.
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'update', 'region_content_links', p_region_id, v_before, p_links);
  return v_count;
end;
$$;
revoke execute on function public.admin_set_region_links(text, jsonb) from public, anon;
grant execute on function public.admin_set_region_links(text, jsonb) to authenticated;

create function public.admin_set_region_intro(p_region_id text, p_language text, p_intro text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  if p_region_id not in ('chuy', 'talas', 'ysyk-kol', 'naryn', 'jalal-abad', 'osh', 'batken') then raise exception 'UNKNOWN_REGION'; end if;
  if p_language not in ('kg', 'ru', 'en') then raise exception 'INVALID_INPUT'; end if;
  select to_jsonb(r) - 'updated_by' into v_before from public.region_intros r where region_id = p_region_id and language = p_language;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'update', 'region_intros', p_region_id || '|' || p_language, v_before, jsonb_build_object('intro', p_intro));
  if p_intro is null or btrim(p_intro) = '' then
    delete from public.region_intros where region_id = p_region_id and language = p_language;
    return;
  end if;
  insert into public.region_intros (region_id, language, intro, updated_by)
  values (p_region_id, p_language, btrim(p_intro), auth.uid())
  on conflict (region_id, language) do update set intro = excluded.intro, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;
revoke execute on function public.admin_set_region_intro(text, text, text) from public, anon;
grant execute on function public.admin_set_region_intro(text, text, text) to authenticated;
