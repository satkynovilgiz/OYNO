-- Real per-account settings storage (master prompt §8's user_settings/
-- user_preferences) - notification/privacy/game preferences were
-- AsyncStorage-only (useSettingsStore), meaning they reset on reinstall
-- or don't follow the user to a second device. Same trigger-on-signup +
-- backfill pattern as profiles/user_progress; select/update own row only,
-- no insert policy (the trigger is the only creator).
--
-- Note: nothing in the app currently reads another user's profile at all
-- (no social/leaderboard feature exists yet), so profileVisibility/
-- leaderboardVisibility/activityVisibility have no real enforcement
-- consumer yet either way - this migration makes the *storage* real
-- (server-backed, cross-device) without pretending visibility rules are
-- being enforced against a feature that doesn't exist.

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications jsonb not null default '{"dailyChallenge":true,"rewards":true,"achievements":true,"friendRequests":true,"gameInvitations":true,"events":true,"news":false}'::jsonb,
  privacy jsonb not null default '{"profileVisibility":"public","leaderboardVisibility":"visible","activityVisibility":"friends"}'::jsonb,
  game jsonb not null default '{"soundEffects":true,"music":true,"haptics":true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "select own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "update own settings" on public.user_settings for update using (auth.uid() = user_id);

create function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute procedure public.handle_new_user_settings();

insert into public.user_settings (user_id)
select id from auth.users
where id not in (select user_id from public.user_settings)
on conflict (user_id) do nothing;

-- Lightweight analytics ingestion (master prompt §32). No third-party
-- vendor - just a real events table, since picking a paid analytics
-- provider is a cost/tooling decision for the user to make, not one to
-- default into silently. `user_id` is nullable so pre-auth events
-- (app_open before sign-in) can still be recorded. Insert-only for
-- everyone (including anon) with their own identity or none - no client
-- role can read this table (analytics is an internal concern; a read
-- policy can be added once the admin panel/RBAC exists to gate it).
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;
grant insert on public.analytics_events to anon, authenticated;
create policy "insert own analytics events" on public.analytics_events for insert
  with check (user_id is null or auth.uid() = user_id);
