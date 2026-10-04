-- My Reports + Feedback Status 1.0 - on the EXISTING beta_feedback table
-- (Feedback 2.0). One record, one status: the admin inbox and the
-- reporter's own list read the same row.
--
-- Status: received (default) -> under_review -> resolved | closed.
-- public_response: an OPTIONAL reply written for the reporter by an admin.
-- It is a separate, explicit field - there are no private admin notes in
-- this table, and none are ever returned to users.
--
-- Access:
--   * the table keeps NO client read policy;
--   * get_my_feedback(): SECURITY DEFINER, rows where user_id = auth.uid()
--     only, and only safe columns (no message body, diagnostics, contact
--     email, screenshot path or user id). Guest reports (user_id NULL) are
--     anonymous and can't be read or claimed later.
--   * admin_set_feedback_status / admin_get_feedback_statuses: admin roles
--     only (require_admin_role), status changes audited.

alter table public.beta_feedback
  add column if not exists status text not null default 'received' check (status in ('received', 'under_review', 'resolved', 'closed')),
  add column if not exists status_updated_at timestamptz,
  add column if not exists public_response text check (public_response is null or char_length(public_response) between 1 and 1000);

create index if not exists beta_feedback_user_status on public.beta_feedback (user_id, created_at desc) where user_id is not null;

create function public.get_my_feedback()
returns table (id uuid, created_at timestamptz, category text, content_type text, content_id text, status text, status_updated_at timestamptz, public_response text)
language sql
stable
security definer set search_path = public
as $$
  select f.id, f.created_at, f.category, f.content_type, f.content_id, f.status, f.status_updated_at, f.public_response
  from public.beta_feedback f
  where auth.uid() is not null and f.user_id = auth.uid()
  order by f.created_at desc
  limit 100;
$$;
revoke execute on function public.get_my_feedback() from public, anon;
grant execute on function public.get_my_feedback() to authenticated;

create function public.admin_get_feedback_statuses()
returns table (id uuid, status text, status_updated_at timestamptz, public_response text)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin_role(array['super_admin', 'content_editor', 'moderator']);
  return query select f.id, f.status, f.status_updated_at, f.public_response from public.beta_feedback f order by f.created_at desc limit 200;
end;
$$;
revoke execute on function public.admin_get_feedback_statuses() from public, anon;
grant execute on function public.admin_get_feedback_statuses() to authenticated;

create function public.admin_set_feedback_status(p_id uuid, p_status text, p_public_response text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_response text := nullif(btrim(coalesce(p_public_response, '')), '');
begin
  perform public.require_admin_role(array['super_admin', 'content_editor', 'moderator']);
  if p_status not in ('received', 'under_review', 'resolved', 'closed') then raise exception 'INVALID_STATUS'; end if;
  if v_response is not null and char_length(v_response) > 1000 then raise exception 'INVALID_RESPONSE'; end if;
  select jsonb_build_object('status', status, 'public_response', public_response) into v_before from public.beta_feedback where id = p_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;
  update public.beta_feedback set status = p_status, status_updated_at = now(), public_response = v_response where id = p_id;
  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'update', 'beta_feedback', p_id::text, v_before, jsonb_build_object('status', p_status, 'public_response', v_response));
end;
$$;
revoke execute on function public.admin_set_feedback_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_feedback_status(uuid, text, text) to authenticated;
