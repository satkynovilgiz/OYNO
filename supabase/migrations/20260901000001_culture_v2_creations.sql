-- Culture Interactive Experience V2: Oymo Creator save/load, Shyrdak
-- Creator save, Komuz Learning completion, and the komuz-overview content
-- the Komuz lesson's Introduction/Parts steps read.
--
-- oymo_creations/shyrdak_creations follow the user_progress-style RLS
-- pattern (select-only for the client, every write through a SECURITY
-- DEFINER function below) rather than the lighter user_avatars-style
-- direct-client-write pattern, because saving awards XP on first save -
-- that write must never be trusted to the client directly (matches the
-- "never trust the client with reward-adjacent writes" rule already
-- applied everywhere else in this file's siblings).

create table public.oymo_creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  layers jsonb not null,
  background_color text not null,
  symmetry_mode text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oymo_creations enable row level security;
create policy "select own oymo creations" on public.oymo_creations for select using (auth.uid() = user_id);

-- Single row per user (a Shyrdak Creator design is one live configuration,
-- not a multi-pattern gallery like Oymo - see the V2 plan).
create table public.shyrdak_creations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_color text not null,
  secondary_color text not null,
  pattern_id text not null,
  border_enabled boolean not null default true,
  symmetry_mode text not null,
  updated_at timestamptz not null default now()
);

alter table public.shyrdak_creations enable row level security;
create policy "select own shyrdak creation" on public.shyrdak_creations for select using (auth.uid() = user_id);

alter table public.user_progress
  add column oymo_created boolean not null default false,
  add column shyrdak_created boolean not null default false,
  add column komuz_lesson_completed boolean not null default false;

-- ---------------------------------------------------------------------
-- Actions. Same shape as visit_boz_uy (20260823000001_progress.sql):
-- derive auth.uid() itself, idempotent first-time flag before rewarding,
-- return { progress: <row> }.
-- ---------------------------------------------------------------------

create function public.save_oymo_creation(p_name text, p_layers jsonb, p_background_color text, p_symmetry_mode text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  insert into public.oymo_creations (user_id, name, layers, background_color, symmetry_mode)
  values (v_user_id, p_name, p_layers, p_background_color, p_symmetry_mode);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if not v_row.oymo_created then
    update public.user_progress set oymo_created = true, updated_at = now() where user_id = v_user_id;
    perform public.apply_reward(v_user_id, 20, 10, 'oymo_creation', null);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.save_oymo_creation(text, jsonb, text, text) to authenticated;

-- Deletes only the caller's own row - a mismatched id/owner deletes 0
-- rows (FOUND stays false), giving the same NOT_FOUND either way rather
-- than leaking whether some other user's row exists.
create function public.delete_oymo_creation(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.oymo_creations where id = p_id and user_id = v_user_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;
grant execute on function public.delete_oymo_creation(uuid) to authenticated;

create function public.save_shyrdak_creation(
  p_base_color text, p_secondary_color text, p_pattern_id text, p_border_enabled boolean, p_symmetry_mode text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  insert into public.shyrdak_creations (user_id, base_color, secondary_color, pattern_id, border_enabled, symmetry_mode)
  values (v_user_id, p_base_color, p_secondary_color, p_pattern_id, p_border_enabled, p_symmetry_mode)
  on conflict (user_id) do update set
    base_color = excluded.base_color,
    secondary_color = excluded.secondary_color,
    pattern_id = excluded.pattern_id,
    border_enabled = excluded.border_enabled,
    symmetry_mode = excluded.symmetry_mode,
    updated_at = now();

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if not v_row.shyrdak_created then
    update public.user_progress set shyrdak_created = true, updated_at = now() where user_id = v_user_id;
    perform public.apply_reward(v_user_id, 20, 10, 'shyrdak_creation', null);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.save_shyrdak_creation(text, text, text, boolean, text) to authenticated;

create function public.complete_komuz_lesson()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_progress;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.apply_daily_reset(v_user_id);

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if not v_row.komuz_lesson_completed then
    update public.user_progress set komuz_lesson_completed = true, updated_at = now() where user_id = v_user_id;
    perform public.apply_reward(v_user_id, 15, 0, 'komuz_lesson', null);
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row));
end;
$$;
grant execute on function public.complete_komuz_lesson() to authenticated;

-- Komuz Learning's Introduction/Parts content - same citations already
-- used for the `komuz-discovery` material (20260831000001), reformatted
-- into culture_items fields. Naming matches the existing
-- boz-uy-overview/oymo-overview convention. cultural_meaning is left null
-- rather than inventing one - only origin/history/objects_used are
-- actually sourced from the citations below.
insert into public.culture_items (
  id, category_id, title, type_label, origin, history, objects_used, fun_facts, accuracy_level, sources, sort_order
) values (
  'komuz-overview', 'komuz', 'Комуз', 'custom',
  'Комуз - кыргыздын эң байыркы үч кылдуу чертме музыкалык аспабы.',
  'Ал окумуштуу Махмуд Кашкаринин XI кылымда жазылган "Дивану лугат-ат-түрк" сөздүгүндө эскерилет.',
  'Баш, моюн, корпус, кутуча, тагоо жана үч кыл. Комуз өрүк, кайың, карагай сыяктуу жыгач түрлөрүнөн оюлуп жасалат.',
  'Түрк элдеринде окшош аспаптар ("кобуз", "комыз") кездешет - бул комуздун эң байыркы музыкалык аспаптардын бири экенин көрсөтөт.',
  'partially_verified',
  array[
    'https://ky.wikipedia.org/wiki/%D0%9A%D0%BE%D0%BC%D1%83%D0%B7',
    'https://kutbilim.kg/methodical/inner/147019/'
  ],
  1
)
on conflict (id) do update set
  title = excluded.title, type_label = excluded.type_label, origin = excluded.origin,
  history = excluded.history, objects_used = excluded.objects_used, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources;
