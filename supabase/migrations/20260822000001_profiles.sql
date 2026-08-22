-- Phase 6a: the first real backend table. Every user-specific table from
-- here on follows the same shape (uuid FK to auth.users, RLS on, owned-row
-- policy) - see BACKEND_PLAN.md §3.1/§5 for the full schema this is part
-- of and the security reasoning behind it.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  character_id text not null default 'bek',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);
-- deleteAccount() deletes this row directly (the client-reachable part of
-- account deletion); the auth.users row itself is only removed via
-- cascade when the underlying account is hard-deleted, which requires the
-- service role - see BACKEND_PLAN.md's note on that being a later phase.

-- No insert policy for the client role: profile rows are only ever
-- created by the trigger below (as the postgres/definer role, which
-- bypasses RLS) immediately after a real signup.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, character_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'characterId', 'bek')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
