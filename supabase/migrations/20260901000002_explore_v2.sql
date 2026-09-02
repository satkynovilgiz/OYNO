-- Explore 2.0: real region-visit tracking, a real discoveries table
-- (replacing the 4 hardcoded/duplicated items in explore_discovery_xp),
-- a general-purpose quest-step engine (only one real quest gets real
-- steps this pass - lost-shyrdak), and favorites. Same rules as every
-- migration before it: every table here is select-only for the client,
-- every write goes through a SECURITY DEFINER function that derives
-- auth.uid() itself and never accepts a client-supplied reward amount.
--
-- No Places or Animals tables - content/explore/*.md flags both as
-- unverified, and no sourced content exists to seed either with (see the
-- Explore 2.0 plan's audit section). Building the schema empty now would
-- just move the "fake card" problem from the UI into the database.

create table public.user_region_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  region_id text not null references public.explore_regions(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (user_id, region_id)
);

alter table public.user_region_visits enable row level security;
create policy "select own region visits" on public.user_region_visits for select using (auth.uid() = user_id);

create table public.discoveries (
  id text primary key,
  region_id text references public.explore_regions(id) on delete set null,
  category text not null check (category in ('nature', 'culture', 'animals', 'food')),
  title_kg text not null,
  title_ru text not null,
  title_en text not null,
  xp_reward integer not null check (xp_reward > 0),
  accuracy_level text not null check (accuracy_level in ('verified', 'partially_verified', 'unverified')),
  sources text[],
  published boolean not null default true,
  sort_order integer not null default 0
);

alter table public.discoveries enable row level security;
create policy "select published discoveries" on public.discoveries for select using (published);

-- Kept region-agnostic (null region_id) unless a discovery has a real,
-- sourced regional tie - only ysyk-kol-shore does (see the plan's audit:
-- boz-uy/too-teke/beshbarmak-dish are national/thematic, not tied to one
-- region). Same ids/xp/titles as the previous hardcoded client copy
-- (src/features/explore/data.ts) and explore_discovery_xp case function.
insert into public.discoveries (id, region_id, category, title_kg, title_ru, title_en, xp_reward, accuracy_level, sources, sort_order)
values
  ('ysyk-kol-shore', 'ysyk-kol', 'nature', 'Ысык-Көлдүн жээги', 'Побережье Иссык-Куля', 'Issyk-Kul shore', 50, 'verified',
    array['https://ky.wikipedia.org/wiki/%D0%AB%D1%81%D1%8B%D0%BA-%D0%9A%D3%A9%D0%BB'], 0),
  ('boz-uy', null, 'culture', 'Боз үй', 'Юрта', 'Boz uy (yurt)', 60, 'verified',
    array['https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9'], 1),
  ('too-teke', null, 'animals', 'Тоо теке', 'Горный козёл', 'Mountain goat', 40, 'partially_verified', null, 2),
  ('beshbarmak-dish', null, 'food', 'Бешбармак', 'Бешбармак', 'Beshbarmak', 50, 'verified',
    array['https://ky.wikipedia.org/wiki/%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA'], 3)
on conflict (id) do update set
  region_id = excluded.region_id, category = excluded.category,
  title_kg = excluded.title_kg, title_ru = excluded.title_ru, title_en = excluded.title_en,
  xp_reward = excluded.xp_reward, accuracy_level = excluded.accuracy_level, sources = excluded.sources;

create table public.quest_steps (
  id text primary key,
  quest_id text not null references public.quests(id) on delete cascade,
  step_order integer not null,
  step_type text not null check (step_type in ('VISIT_LOCATION', 'DISCOVER_ITEM', 'OPEN_CULTURE_ITEM', 'COMPLETE_QUIZ')),
  target_id text not null,
  title_kg text not null,
  title_ru text not null,
  title_en text not null,
  sort_order integer not null default 0,
  unique (quest_id, step_order)
);

alter table public.quest_steps enable row level security;
create policy "select quest steps" on public.quest_steps for select using (true);

-- lost-shyrdak's 5 real steps - every target already exists in the DB
-- (explore_regions, discoveries, culture_items), no invented content. A
-- fitting payoff for "find the lost shyrdak" to end on the real
-- shyrdak-craft culture item.
insert into public.quest_steps (id, quest_id, step_order, step_type, target_id, title_kg, title_ru, title_en, sort_order)
values
  ('lost-shyrdak-1', 'lost-shyrdak', 1, 'VISIT_LOCATION', 'ysyk-kol', 'Ысык-Көлгө бар', 'Посети Иссык-Куль', 'Visit Issyk-Kul', 0),
  ('lost-shyrdak-2', 'lost-shyrdak', 2, 'DISCOVER_ITEM', 'boz-uy', 'Боз үйдү тап', 'Найди юрту', 'Find the boz uy', 1),
  ('lost-shyrdak-3', 'lost-shyrdak', 3, 'OPEN_CULTURE_ITEM', 'boz-uy-overview', 'Боз үй жөнүндө оку', 'Изучи боз үй', 'Read about the boz uy', 2),
  ('lost-shyrdak-4', 'lost-shyrdak', 4, 'OPEN_CULTURE_ITEM', 'oymo-overview', 'Оймо жөнүндө оку', 'Изучи оймо', 'Read about oymo', 3),
  ('lost-shyrdak-5', 'lost-shyrdak', 5, 'OPEN_CULTURE_ITEM', 'shyrdak-craft', 'Шырдак жөнүндө оку', 'Изучи шырдак', 'Read about the shyrdak', 4)
on conflict (id) do update set
  step_order = excluded.step_order, step_type = excluded.step_type, target_id = excluded.target_id,
  title_kg = excluded.title_kg, title_ru = excluded.title_ru, title_en = excluded.title_en, sort_order = excluded.sort_order;

create table public.user_quest_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  step_id text not null references public.quest_steps(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

alter table public.user_quest_steps enable row level security;
create policy "select own quest steps" on public.user_quest_steps for select using (auth.uid() = user_id);

create table public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('region', 'nature')),
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table public.user_favorites enable row level security;
create policy "select own favorites" on public.user_favorites for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------

-- No reward - opening a region isn't itself an XP-earning action (matches
-- the existing reward list, which has no "opened a region" entry).
-- Idempotent insert so re-visiting is a harmless no-op.
create function public.visit_explore_region(p_region_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.explore_regions where id = p_region_id) then
    raise exception 'UNKNOWN_REGION';
  end if;
  insert into public.user_region_visits (user_id, region_id) values (v_user_id, p_region_id) on conflict do nothing;
end;
$$;
grant execute on function public.visit_explore_region(text) to authenticated;

-- Rewritten to read the reward from the discoveries table instead of the
-- old explore_discovery_xp hardcoded case function, so admin-added
-- discoveries work without another migration.
create or replace function public.discover_explore_item(p_discovery_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_rows int;
  v_xp_reward int;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select xp_reward into v_xp_reward from public.discoveries where id = p_discovery_id and published;
  if v_xp_reward is null then raise exception 'UNKNOWN_DISCOVERY'; end if;
  perform public.apply_daily_reset(v_user_id);

  insert into public.user_discoveries (user_id, discovery_id) values (v_user_id, p_discovery_id) on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    perform public.apply_reward(v_user_id, v_xp_reward, 0, 'explore_discovery', p_discovery_id);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;

drop function if exists public.explore_discovery_xp(text);

-- Advances the caller's own next incomplete step of the given quest, but
-- only if (p_step_type, p_target_id) matches that specific step - the
-- client reports "this event just happened" (region opened, item
-- discovered, culture item read), it can't skip ahead or claim an
-- arbitrary step out of order. A non-matching or already-quest-completed
-- call is a harmless no-op (returns the current progress unchanged),
-- since the same event-report call sites (region mount, discovery,
-- culture item mount) fire regardless of whether they happen to be the
-- user's actual next quest step.
create function public.advance_quest_step(p_step_type text, p_target_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
  v_newly text[] := '{}';
  v_next_step public.quest_steps;
  v_quest_total int;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;

  if not v_row.quest_completed then
    select qs.* into v_next_step
    from public.quest_steps qs
    where qs.quest_id = 'lost-shyrdak'
      and not exists (select 1 from public.user_quest_steps uqs where uqs.user_id = v_user_id and uqs.step_id = qs.id)
    order by qs.step_order
    limit 1;

    if v_next_step.id is not null and v_next_step.step_type = p_step_type and v_next_step.target_id = p_target_id then
      insert into public.user_quest_steps (user_id, step_id) values (v_user_id, v_next_step.id);

      select total_count into v_quest_total from public.quests where id = 'lost-shyrdak';
      update public.user_progress
      set quest_found_count = quest_found_count + 1,
          quest_completed = (quest_found_count + 1) >= v_quest_total,
          updated_at = now()
      where user_id = v_user_id;

      select * into v_row from public.user_progress where user_id = v_user_id;
      if v_row.quest_completed then
        perform public.apply_reward(v_user_id, 80, 40, 'quest_complete', 'lost-shyrdak');
      end if;
      v_newly := public.check_achievements(v_user_id);
    end if;
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'newlyUnlocked', to_jsonb(v_newly));
end;
$$;
grant execute on function public.advance_quest_step(text, text) to authenticated;

create function public.toggle_favorite(p_target_type text, p_target_id text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted int;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  delete from public.user_favorites where user_id = v_user_id and target_type = p_target_type and target_id = p_target_id;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    return false;
  end if;

  insert into public.user_favorites (user_id, target_type, target_id) values (v_user_id, p_target_type, p_target_id);
  return true;
end;
$$;
grant execute on function public.toggle_favorite(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Admin CMS (same require_admin_role + audit-log pattern as
-- admin_upsert_explore_region/admin_upsert_quest in
-- 20260829000004_admin_content_extended.sql). No admin path grants XP or
-- coins directly - these only ever edit content rows.
-- ---------------------------------------------------------------------

create function public.admin_upsert_discovery(
  p_id text, p_region_id text, p_category text, p_title_kg text, p_title_ru text, p_title_en text,
  p_xp_reward int, p_accuracy_level text, p_sources text[], p_published boolean, p_sort_order int
)
returns public.discoveries
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.discoveries;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(d) into v_before from public.discoveries d where id = p_id;

  insert into public.discoveries (id, region_id, category, title_kg, title_ru, title_en, xp_reward, accuracy_level, sources, published, sort_order)
  values (p_id, p_region_id, p_category, p_title_kg, p_title_ru, p_title_en, p_xp_reward, p_accuracy_level, p_sources, p_published, p_sort_order)
  on conflict (id) do update set
    region_id = excluded.region_id, category = excluded.category,
    title_kg = excluded.title_kg, title_ru = excluded.title_ru, title_en = excluded.title_en,
    xp_reward = excluded.xp_reward, accuracy_level = excluded.accuracy_level, sources = excluded.sources,
    published = excluded.published, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'discoveries', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_discovery(text, text, text, text, text, text, int, text, text[], boolean, int) to authenticated;

create function public.admin_delete_discovery(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(d) into v_before from public.discoveries d where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.discoveries where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'discoveries', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_discovery(text) to authenticated;

create function public.admin_upsert_quest_step(
  p_id text, p_quest_id text, p_step_order int, p_step_type text, p_target_id text,
  p_title_kg text, p_title_ru text, p_title_en text, p_sort_order int
)
returns public.quest_steps
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.quest_steps;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(qs) into v_before from public.quest_steps qs where id = p_id;

  insert into public.quest_steps (id, quest_id, step_order, step_type, target_id, title_kg, title_ru, title_en, sort_order)
  values (p_id, p_quest_id, p_step_order, p_step_type, p_target_id, p_title_kg, p_title_ru, p_title_en, p_sort_order)
  on conflict (id) do update set
    quest_id = excluded.quest_id, step_order = excluded.step_order, step_type = excluded.step_type,
    target_id = excluded.target_id, title_kg = excluded.title_kg, title_ru = excluded.title_ru,
    title_en = excluded.title_en, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'quest_steps', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_quest_step(text, text, int, text, text, text, text, text, int) to authenticated;

create function public.admin_delete_quest_step(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(qs) into v_before from public.quest_steps qs where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.quest_steps where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'quest_steps', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_quest_step(text) to authenticated;
