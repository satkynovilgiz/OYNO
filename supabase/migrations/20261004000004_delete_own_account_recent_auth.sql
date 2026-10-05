-- Account deletion: require a RECENT sign-in, enforced server-side.
--
-- Before: delete_own_account() only required a signed-in session
-- (auth.uid()). The password/provider confirmation happened in the app,
-- so any long-lived session token could delete its account without the
-- person ever confirming it.
--
-- After: the request's JWT must carry an authentication method whose
-- timestamp is within the last 10 minutes. Supabase access tokens list
-- every sign-in method used for the session in the `amr` claim, e.g.
--   "amr": [{"method": "password", "timestamp": 1759600000}]
--   "amr": [{"method": "oauth",    "timestamp": 1759600000}]
-- Refreshing a token keeps these timestamps, so only a genuine new
-- sign-in (the app's password check, or its provider re-sign-in for
-- OAuth-only accounts) satisfies the check. Identity is still auth.uid():
-- the function can only ever delete the account that just signed in.
--
-- Error contract (the app maps it): REAUTH_REQUIRED -> "please confirm
-- again, nothing was deleted"; NOT_AUTHENTICATED unchanged.
--
-- Compatible with already-installed app versions: they always sign in
-- with the password right before calling this function.
--
-- NOT applied to the live project by this change. Apply it via the SQL
-- editor / migration pipeline after reviewing (see docs/TESTFLIGHT_READINESS.md §6).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amr jsonb := auth.jwt() -> 'amr';
  v_last_auth bigint;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_amr is not null and jsonb_typeof(v_amr) = 'array' then
    select max((entry ->> 'timestamp')::bigint) into v_last_auth
    from jsonb_array_elements(v_amr) entry
    where jsonb_typeof(entry -> 'timestamp') = 'number';
  end if;

  if v_last_auth is null or to_timestamp(v_last_auth) < now() - interval '10 minutes' then
    raise exception 'REAUTH_REQUIRED';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
