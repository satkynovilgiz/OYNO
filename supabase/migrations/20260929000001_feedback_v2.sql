-- Feedback + Report Content 2.0.
--
-- 1. New categories: 'culture_correction' (incorrect cultural information),
--    'image' (image issue), 'suggestion' (feature idea). The old ones stay
--    valid so reports already queued on phones still send.
-- 2. Optional, structured content context for content reports - which
--    culture item / material / destination, which language, an optional
--    suggested correction and an optional source link. Stored as data for
--    editors to review: nothing here ever changes content automatically.
-- 3. submit_beta_feedback_v2 - the same validation, idempotency and
--    per-account throttle as submit_beta_feedback (kept unchanged for older
--    app builds), plus the content context.
-- 4. admin_get_beta_feedback - editors/moderators read reports in the
--    in-app admin. It returns what the reporter submitted, minus account
--    identifiers: no user_id, and an opted-in contact email only as a flag.

alter table public.beta_feedback drop constraint if exists beta_feedback_category_check;
alter table public.beta_feedback add constraint beta_feedback_category_check
  check (category in ('bug', 'translation', 'culture_correction', 'image', 'suggestion', 'other', 'ui', 'content', 'performance'));

alter table public.beta_feedback
  add column if not exists content_type text check (content_type is null or content_type in ('culture_item', 'culture_material', 'explore_region', 'discovery', 'collection', 'trail', 'game')),
  add column if not exists content_id text check (content_id is null or content_id ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  add column if not exists content_language text check (content_language is null or content_language in ('kg', 'ru', 'en')),
  add column if not exists suggested_correction text check (suggested_correction is null or char_length(suggested_correction) between 1 and 2000),
  add column if not exists source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~* '^https?://[^\s/?#]+\.[^\s]+$'));

create index if not exists beta_feedback_category_recent on public.beta_feedback (category, created_at desc);

create function public.submit_beta_feedback_v2(
  p_client_report_id uuid,
  p_category text,
  p_message text,
  p_diagnostics jsonb,
  p_screenshot_path text,
  p_link_account boolean,
  p_content jsonb
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
  v_content jsonb := coalesce(p_content, '{}'::jsonb);
  v_content_type text := nullif(btrim(v_content ->> 'content_type'), '');
  v_content_id text := nullif(btrim(v_content ->> 'content_id'), '');
  v_language text := nullif(btrim(v_content ->> 'language'), '');
  v_correction text := nullif(btrim(v_content ->> 'suggested_correction'), '');
  v_source_url text := nullif(btrim(v_content ->> 'source_url'), '');
begin
  if p_client_report_id is null then raise exception 'INVALID_INPUT'; end if;
  if p_category is null or p_category not in ('bug', 'translation', 'culture_correction', 'image', 'suggestion', 'other', 'ui', 'content', 'performance') then
    raise exception 'INVALID_CATEGORY';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 4000 then raise exception 'INVALID_MESSAGE'; end if;
  if jsonb_typeof(v_diagnostics) <> 'object' or pg_column_size(v_diagnostics) > 16384 then raise exception 'INVALID_DIAGNOSTICS'; end if;
  if jsonb_typeof(v_content) <> 'object' or pg_column_size(v_content) > 8192 then raise exception 'INVALID_CONTENT'; end if;
  if p_screenshot_path is not null and p_screenshot_path !~ '^screenshots/[0-9a-f-]{36}\.(jpg|png)$' then
    raise exception 'INVALID_SCREENSHOT';
  end if;
  if v_content_type is not null and v_content_type not in ('culture_item', 'culture_material', 'explore_region', 'discovery', 'collection', 'trail', 'game') then raise exception 'INVALID_CONTENT'; end if;
  if v_content_id is not null and v_content_id !~ '^[a-z0-9][a-z0-9_-]{0,119}$' then raise exception 'INVALID_CONTENT'; end if;
  if v_language is not null and v_language not in ('kg', 'ru', 'en') then raise exception 'INVALID_CONTENT'; end if;
  if v_correction is not null and char_length(v_correction) > 2000 then raise exception 'INVALID_CONTENT'; end if;
  if v_source_url is not null and (char_length(v_source_url) > 500 or v_source_url !~* '^https?://[^\s/?#]+\.[^\s]+$') then raise exception 'INVALID_SOURCE_URL'; end if;

  -- A retry of a report the server already has: return it, never count it twice.
  select id into v_id from public.beta_feedback where client_report_id = p_client_report_id;
  if v_id is not null then return v_id; end if;

  if v_user_id is not null and (
    select count(*) from public.beta_feedback where user_id = v_user_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.beta_feedback (client_report_id, category, message, diagnostics, screenshot_path, user_id, content_type, content_id, content_language, suggested_correction, source_url)
  values (p_client_report_id, p_category, v_message, v_diagnostics, p_screenshot_path, v_user_id, v_content_type, v_content_id, v_language, v_correction, v_source_url)
  on conflict (client_report_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.beta_feedback where client_report_id = p_client_report_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.submit_beta_feedback_v2(uuid, text, text, jsonb, text, boolean, jsonb) to anon, authenticated;

create function public.admin_get_beta_feedback(p_category text default null)
returns table (
  id uuid,
  created_at timestamptz,
  category text,
  message text,
  content_type text,
  content_id text,
  content_language text,
  suggested_correction text,
  source_url text,
  diagnostics jsonb,
  has_screenshot boolean,
  has_contact_email boolean
)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor', 'moderator']);
  return query
    select f.id, f.created_at, f.category, f.message, f.content_type, f.content_id, f.content_language, f.suggested_correction, f.source_url,
      f.diagnostics - 'contactEmail',
      f.screenshot_path is not null,
      f.diagnostics ? 'contactEmail'
    from public.beta_feedback f
    where p_category is null or f.category = p_category
    order by f.created_at desc
    limit 200;
end;
$$;
revoke execute on function public.admin_get_beta_feedback(text) from public, anon;
grant execute on function public.admin_get_beta_feedback(text) to authenticated;
