-- Account deletion: bind the delete to the account that confirmed it, and
-- count only INTERACTIVE sign-ins as "recent".
--
-- Supersedes 20261004000004 (safe whether or not that one was applied):
--
-- 1. Recent-auth check, reviewed against Supabase's JWT reference
--    (https://supabase.com/docs/guides/auth/jwt-fields): `amr` is an array
--    of {method, timestamp (unix seconds)}. Its methods include
--    "token_refresh" and "anonymous" - neither is a person proving who they
--    are. 20261004000004 took the newest timestamp of ANY method, so a
--    routine token refresh could have satisfied it. Now only interactive
--    methods count: password, oauth, otp, totp, magiclink, sso/saml.
--
-- 2. delete_own_account(p_expected_user_id): the app passes the id of the
--    account the person opened the deletion dialog for. The function
--    refuses (ACCOUNT_MISMATCH) unless the token's auth.uid() is exactly
--    that account - so a session that changed after the confirmation can
--    never delete a different account. The check and the delete run in one
--    statement on the server; there is no client-side gap.
--
-- 3. The old no-argument delete_own_account() keeps working for installed
--    app versions (they confirm with a password immediately before calling
--    it), now with the corrected recent-auth check.
--
-- Error contract: NOT_AUTHENTICATED, REAUTH_REQUIRED, ACCOUNT_MISMATCH.
--
-- NOT applied to the live project by this change - see
-- docs/TESTFLIGHT_READINESS.md §6 for how to apply and verify it.
-- No local Postgres was available to execute it in CI/dev (2026-10-05);
-- verify on a staging project first.

create or replace function public.has_recent_interactive_auth(p_window interval default interval '10 minutes')
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select max((entry ->> 'timestamp')::bigint)
       from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) entry
      where jsonb_typeof(entry -> 'timestamp') = 'number'
        and entry ->> 'method' in ('password', 'oauth', 'otp', 'totp', 'magiclink', 'sso/saml')
    ) >= extract(epoch from now() - p_window)::bigint,
    false);
$$;
revoke execute on function public.has_recent_interactive_auth(interval) from public, anon, authenticated;

create or replace function public.delete_own_account(p_expected_user_id uuid)
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
  if p_expected_user_id is null or v_user_id <> p_expected_user_id then
    raise exception 'ACCOUNT_MISMATCH';
  end if;
  if not public.has_recent_interactive_auth() then
    raise exception 'REAUTH_REQUIRED';
  end if;
  delete from auth.users where id = v_user_id;
end;
$$;
revoke execute on function public.delete_own_account(uuid) from public, anon;
grant execute on function public.delete_own_account(uuid) to authenticated;

-- Older app versions (no expected-id argument).
create or replace function public.delete_own_account()
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
  if not public.has_recent_interactive_auth() then
    raise exception 'REAUTH_REQUIRED';
  end if;
  delete from auth.users where id = v_user_id;
end;
$$;
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
