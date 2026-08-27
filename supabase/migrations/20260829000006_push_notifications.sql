-- Push notifications - was entirely missing (only a local, client-side
-- notification center existed, see useNotificationsStore). This adds:
-- 1) real device token registration (push_tokens), so the server knows
--    who to send to, and
-- 2) a genuinely server-driven send path using pg_net (Postgres's async
--    HTTP extension) to call Expo's push API directly from a SECURITY
--    DEFINER function - no Edge Function deploy needed, which matters in
--    this environment: the Supabase CLI can't do an interactive
--    `supabase login` here (see delete_own_account's migration comment
--    for the identical constraint), so Edge Functions aren't deployable
--    without the project owner doing that themselves. pg_net keeps the
--    whole feature applyable through the SQL Editor like every other
--    migration this project has shipped.
--
-- Scope note: this ships a real admin-triggered broadcast (any admin can
-- message every registered device), not a scheduled/automated push (e.g.
-- "remind inactive users") - that needs pg_cron plus actual product logic
-- for when to fire, which is a separate decision, not just infrastructure.

create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;
create policy "select own push tokens" on public.push_tokens for select using (auth.uid() = user_id);
-- No client insert/update/delete policy - registration goes through
-- register_push_token()/unregister_push_token() below, same
-- never-trust-a-raw-write pattern as every other user-owned table here.

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_platform not in ('ios', 'android', 'web') then raise exception 'INVALID_PLATFORM'; end if;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (v_user_id, p_token, p_platform, now())
  on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now();
end;
$$;
grant execute on function public.register_push_token(text, text) to authenticated;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.push_tokens where user_id = auth.uid() and token = p_token;
end;
$$;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Fire-and-forget broadcast to every registered device. net.http_post is
-- async (queues the request and returns immediately - Postgres doesn't
-- block waiting for Expo's response), so this can't report per-device
-- delivery success; it reports how many tokens the request was sent for.
-- Every call is audit-logged like every other admin action.
create function public.admin_send_push_broadcast(p_title text, p_body text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_tokens text[];
  v_messages jsonb;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);

  select array_agg(distinct token) into v_tokens from public.push_tokens;
  if v_tokens is null or array_length(v_tokens, 1) = 0 then
    return 0;
  end if;

  select jsonb_agg(jsonb_build_object('to', t, 'title', p_title, 'body', p_body))
  into v_messages
  from unnest(v_tokens) as t;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body := v_messages
  );

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, after)
  values (
    auth.uid(), 'send_push_broadcast', 'push_tokens', 'broadcast',
    jsonb_build_object('title', p_title, 'body', p_body, 'recipient_count', array_length(v_tokens, 1))
  );

  return array_length(v_tokens, 1);
end;
$$;
grant execute on function public.admin_send_push_broadcast(text, text) to authenticated;
