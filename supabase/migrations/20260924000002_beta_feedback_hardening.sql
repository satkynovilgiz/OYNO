-- Beta feedback abuse protection (guest reports stay supported).
--
-- Already enforced by 20260923000002_beta_feedback.sql and kept as-is:
--   * category allow-list, message 1..4000 chars, diagnostics <= 16 KB,
--     screenshot path format (table CHECK constraints)
--   * idempotency: unique client_report_id
--   * screenshots: private bucket, 3 MB, image/jpeg|png only, no client
--     read/list/update/delete
--
-- Added here (replaces the function, same signature and behaviour for
-- valid input):
--   * explicit validation with clear, permanent error codes the app can
--     tell apart from temporary network errors (INVALID_CATEGORY,
--     INVALID_MESSAGE, INVALID_DIAGNOSTICS, INVALID_SCREENSHOT)
--   * a per-account throttle for reports linked to a signed-in account:
--     at most 20 in any hour (RATE_LIMITED - the app keeps the report
--     queued and retries later)
--
-- NOT done here, deliberately: rate limiting ANONYMOUS reports. Doing that
-- honestly needs a per-client identity (IP) that Postgres doesn't see
-- through PostgREST, and the project rules out device fingerprinting.
-- Deployment recommendation: enable Supabase's API rate limits / put the
-- RPC and the beta-feedback upload behind an edge function or gateway
-- with per-IP limits before a public (non-invited) beta.

create or replace function public.submit_beta_feedback(
  p_client_report_id uuid,
  p_category text,
  p_message text,
  p_diagnostics jsonb,
  p_screenshot_path text,
  p_link_account boolean
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := case when p_link_account then auth.uid() else null end;
  v_message text := btrim(coalesce(p_message, ''));
  v_diagnostics jsonb := coalesce(p_diagnostics, '{}'::jsonb);
begin
  if p_client_report_id is null then raise exception 'INVALID_INPUT'; end if;
  if p_category is null or p_category not in ('bug', 'ui', 'content', 'translation', 'performance', 'other') then
    raise exception 'INVALID_CATEGORY';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 4000 then raise exception 'INVALID_MESSAGE'; end if;
  if jsonb_typeof(v_diagnostics) <> 'object' or pg_column_size(v_diagnostics) > 16384 then raise exception 'INVALID_DIAGNOSTICS'; end if;
  if p_screenshot_path is not null and p_screenshot_path !~ '^screenshots/[0-9a-f-]{36}\.(jpg|png)$' then
    raise exception 'INVALID_SCREENSHOT';
  end if;

  -- A retry of a report the server already has: return it, never count it twice.
  select id into v_id from public.beta_feedback where client_report_id = p_client_report_id;
  if v_id is not null then return v_id; end if;

  if v_user_id is not null and (
    select count(*) from public.beta_feedback where user_id = v_user_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.beta_feedback (client_report_id, category, message, diagnostics, screenshot_path, user_id)
  values (p_client_report_id, p_category, v_message, v_diagnostics, p_screenshot_path, v_user_id)
  on conflict (client_report_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.beta_feedback where client_report_id = p_client_report_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.submit_beta_feedback(uuid, text, text, jsonb, text, boolean) to anon, authenticated;

create index if not exists beta_feedback_user_recent on public.beta_feedback (user_id, created_at) where user_id is not null;
