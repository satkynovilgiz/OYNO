-- QA audit CRITICAL finding: deleteAccount() only ever removed the
-- `profiles` row, never the underlying `auth.users` row - it's called out
-- in that function's own prior doc comment as needing "the service role,
-- which never runs on-device... a service-role Edge Function (not built
-- this pass)". BACKEND_PLAN.md originally scoped hard-deletion as an Edge
-- Function for exactly that reason.
--
-- This avoids needing an Edge Function (and the service-role key/CLI login
-- that would require) by using the same trick this project already relies
-- on everywhere else (see progress.sql's apply_reward, check_achievements,
-- etc.): a `security definer` function, applied via the SQL Editor as the
-- project-owner role, which already has the grants needed to touch
-- `auth.users` directly. Every user-owned table in this schema already has
-- `on delete cascade references auth.users(id)` (profiles, user_progress,
-- xp_events, coin_transactions, user_achievements, user_discoveries,
-- user_settings, notification tables), so deleting the auth.users row
-- cascades through all of it in one statement - no separate cleanup needed.
--
-- Known limitation, not addressed here: admin.sql's `role_grants.granted_by`
-- and `admin_audit_log.admin_user_id` reference auth.users(id) without
-- cascade, so this will fail with a foreign-key error if ever called for an
-- account that has acted as an admin. Out of scope for a normal end-user
-- self-service delete - admin account deletion needs its own reassignment
-- story, not a silent cascade.

create function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
