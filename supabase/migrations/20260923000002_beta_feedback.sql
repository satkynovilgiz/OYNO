-- Beta feedback from inside the app (Settings -> Help & Feedback, and the
-- "Report a problem" action on error / not-found screens).
--
-- Guests can report too (anon role): a beta tester shouldn't need an
-- account to say "this screen is broken". Security model:
--   * the table has RLS on and NO client select/insert/update/delete
--     policy - the app writes only through submit_beta_feedback(), and
--     reports are read in the Supabase dashboard, never by other clients;
--   * user_id comes from auth.uid() (never a parameter) and is only kept
--     when the device says the report was written by the signed-in user;
--   * client_report_id is unique, so a retried send (flaky network,
--     offline queue) can never create a duplicate report;
--   * screenshots go to a PRIVATE bucket: clients may upload one image
--     under screenshots/, but nobody can list, read, replace or delete it
--     from the app.

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  client_report_id uuid not null unique,
  created_at timestamptz not null default now(),
  category text not null check (category in ('bug', 'ui', 'content', 'translation', 'performance', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  diagnostics jsonb not null default '{}'::jsonb check (pg_column_size(diagnostics) <= 16384),
  screenshot_path text check (screenshot_path is null or screenshot_path ~ '^screenshots/[0-9a-f-]{36}\.(jpg|png)$'),
  user_id uuid references auth.users(id) on delete set null
);

alter table public.beta_feedback enable row level security;

create function public.submit_beta_feedback(
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
begin
  if p_client_report_id is null then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(coalesce(p_diagnostics, '{}'::jsonb)) <> 'object' then raise exception 'INVALID_INPUT'; end if;

  insert into public.beta_feedback (client_report_id, category, message, diagnostics, screenshot_path, user_id)
  values (
    p_client_report_id,
    p_category,
    btrim(p_message),
    coalesce(p_diagnostics, '{}'::jsonb),
    p_screenshot_path,
    case when p_link_account then auth.uid() else null end
  )
  on conflict (client_report_id) do nothing
  returning id into v_id;

  -- Already received (a retry): return the existing report's id.
  if v_id is null then
    select id into v_id from public.beta_feedback where client_report_id = p_client_report_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.submit_beta_feedback(uuid, text, text, jsonb, text, boolean) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('beta-feedback', 'beta-feedback', false, 3145728, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "upload beta feedback screenshots"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'beta-feedback'
    and name ~ '^screenshots/[0-9a-f-]{36}\.(jpg|png)$'
  );
