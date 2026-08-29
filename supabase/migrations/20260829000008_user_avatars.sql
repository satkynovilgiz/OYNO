-- Real per-account storage for the user's own customizable avatar - this
-- is distinct from profiles.character_id, which picks a *story companion*
-- (Бек/Айдана/Аяна, the guide/host shown in games and cultural
-- experiences) and is never touched by this feature. Follows the exact
-- same trigger-on-signup + backfill + RLS shape as user_settings
-- (20260825000001_settings_and_analytics.sql): a single jsonb blob,
-- because nothing server-side ever needs to query individual avatar
-- fields, and the item catalog (src/services/avatar/avatarCatalog.ts)
-- will grow across app updates without needing a migration each time.
--
-- Two known, deliberate gaps, documented rather than hidden:
-- 1) Unlock eligibility (games played, discoveries, streak, level - see
--    src/services/avatar/avatarUnlocks.ts) is enforced *only* in the
--    editor UI. Nothing here stops a hand-crafted client request from
--    writing a locked item id into its own config. Acceptable for a
--    purely cosmetic feature with no economy value - the same trust
--    level this table's own RLS already gives every other self-service
--    field a user can freely edit (name, settings, etc).
-- 2) The default config below must be kept in lockstep by hand with
--    DEFAULT_AVATAR_CONFIG in src/services/avatar/defaultAvatar.ts - both
--    must reference the same "starter" item ids that avatarCatalog.ts
--    marks unlock:{type:'free'}.

create table public.user_avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{
    "version": 1,
    "skinTone": "skin_03",
    "faceShape": "oval",
    "body": "average",
    "eyes": "round",
    "eyeColor": "brown",
    "eyebrows": "straight",
    "nose": "default",
    "mouth": "neutral",
    "hair": "hair_01",
    "hairColor": "black",
    "headwear": "none",
    "clothing": "hoodie",
    "accessory": "none",
    "background": "beige"
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_avatars enable row level security;

create policy "select own avatar" on public.user_avatars for select using (auth.uid() = user_id);
create policy "update own avatar" on public.user_avatars for update using (auth.uid() = user_id);
-- No insert policy for the client role - rows are only ever created by
-- the trigger below (or the one-off backfill immediately after it),
-- same as profiles/user_settings.

create trigger user_avatars_set_updated_at
  before update on public.user_avatars
  for each row execute procedure public.set_updated_at(); -- generic function, already defined in 20260822000001_profiles.sql

create function public.handle_new_user_avatar()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_avatars (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_avatar
  after insert on auth.users
  for each row execute procedure public.handle_new_user_avatar();

-- Backfill for every account that signed up before this migration.
insert into public.user_avatars (user_id)
select id from auth.users
where id not in (select user_id from public.user_avatars)
on conflict (user_id) do nothing;
