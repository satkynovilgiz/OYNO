-- Phase 6d (slice 1): admin RBAC, audit log, and admin-write actions for
-- the Phase 6c content tables. Same pattern as every previous phase:
-- SECURITY DEFINER functions are the only write path, never a raw RLS
-- insert/update/delete policy for a client role - this is what makes the
-- audit log (master prompt §88) actually trustworthy instead of a
-- convention the client could just skip.
--
-- Bootstrapping the first super_admin requires a one-time manual insert
-- (there's no signed-in admin yet to grant the first one) - done once via
-- the SQL Editor, documented in PROGRESS_AUDIT.md.

create table public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'content_editor', 'moderator', 'analytics_viewer')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id)
);

-- A user can read their own role row (so the admin app can check "am I
-- allowed in" without a round trip through a function) but never write
-- it - role grants only happen through grant_admin_role() below.
alter table public.admin_roles enable row level security;
create policy "select own admin role" on public.admin_roles for select using (auth.uid() = user_id);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_table text not null,
  target_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Only admins can read the audit log (of their own actions or anyone
-- else's - it's an accountability log, not private data). No client
-- write policy: every row is inserted by the SECURITY DEFINER functions
-- below, never directly.
alter table public.admin_audit_log enable row level security;
create policy "admins read audit log" on public.admin_audit_log for select
  using (exists (select 1 from public.admin_roles where user_id = auth.uid()));

create function public.current_admin_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.admin_roles where user_id = auth.uid();
$$;

create function public.require_admin_role(p_allowed_roles text[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := public.current_admin_role();
begin
  if v_role is null or not (v_role = any(p_allowed_roles)) then
    raise exception 'NOT_AUTHORIZED';
  end if;
end;
$$;

-- Only an existing super_admin can grant roles - never granted by RLS,
-- never self-service. The very first super_admin is seeded by hand (see
-- PROGRESS_AUDIT.md) since there's no admin yet to call this for it.
create function public.grant_admin_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin']);
  insert into public.admin_roles (user_id, role, granted_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, after)
  values (auth.uid(), 'grant_role', 'admin_roles', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;
grant execute on function public.grant_admin_role(uuid, text) to authenticated;

-- Admins (any role) can view every profile - moderation/support needs
-- this, and it's not sensitive the way auth credentials are. Still no
-- write policy for any client role: profile edits stay user-owned.
create policy "admins read all profiles" on public.profiles for select
  using (exists (select 1 from public.admin_roles where user_id = auth.uid()));

create policy "admins read all progress" on public.user_progress for select
  using (exists (select 1 from public.admin_roles where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Content management actions (super_admin, content_editor). Each
-- upsert/delete writes the row, then an audit log entry, atomically -
-- there is no path to change published content without a matching audit
-- row.
-- ---------------------------------------------------------------------

create function public.admin_upsert_culture_category(p_id text, p_title text, p_sort_order int)
returns public.culture_categories
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.culture_categories;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(c) into v_before from public.culture_categories c where id = p_id;

  insert into public.culture_categories (id, title, sort_order)
  values (p_id, p_title, p_sort_order)
  on conflict (id) do update set title = excluded.title, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'culture_categories', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_culture_category(text, text, int) to authenticated;

create function public.admin_delete_culture_category(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(c) into v_before from public.culture_categories c where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.culture_categories where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'culture_categories', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_culture_category(text) to authenticated;

create function public.admin_upsert_culture_material(
  p_id text, p_kind text, p_title text, p_description text, p_duration_minutes int, p_sort_order int
)
returns public.culture_materials
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_row public.culture_materials;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(m) into v_before from public.culture_materials m where id = p_id;

  insert into public.culture_materials (id, kind, title, description, duration_minutes, sort_order)
  values (p_id, p_kind, p_title, p_description, p_duration_minutes, p_sort_order)
  on conflict (id) do update set
    kind = excluded.kind, title = excluded.title, description = excluded.description,
    duration_minutes = excluded.duration_minutes, sort_order = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'culture_materials', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_culture_material(text, text, text, text, int, int) to authenticated;

create function public.admin_delete_culture_material(p_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select to_jsonb(m) into v_before from public.culture_materials m where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  delete from public.culture_materials where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before)
  values (auth.uid(), 'delete', 'culture_materials', p_id, v_before);
end;
$$;
grant execute on function public.admin_delete_culture_material(text) to authenticated;
