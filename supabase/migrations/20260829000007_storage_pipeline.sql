-- Storage/CDN pipeline, slice 1. Every image and audio file in this app
-- is currently bundled into the app binary via require() (see
-- src/features/culture/audioData.ts's own comment, and every
-- cultureItemImages/cultureCategoryImages lookup map) - real, but it
-- means the CMS built in Phase 6d can only ever edit text: adding a new
-- photo to a culture_items row still needs a new app build and store
-- release, which defeats a real chunk of what a CMS is for. This adds
-- real Storage-backed image support for culture_items specifically (the
-- richest, most CMS-managed content type) as the first slice, not every
-- content table at once.
--
-- Bucket is public-read (content-media is published content, same
-- classification as culture_items/explore_regions themselves - no
-- reason to sign URLs for it), admin-write-only via storage.objects RLS
-- keyed to admin_roles, same shape as every other admin-gated write in
-- this project.

insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

create policy "public read content-media"
  on storage.objects for select
  using (bucket_id = 'content-media');

create policy "admins upload to content-media"
  on storage.objects for insert
  with check (
    bucket_id = 'content-media'
    and exists (select 1 from public.admin_roles where user_id = auth.uid())
  );

create policy "admins update content-media"
  on storage.objects for update
  using (
    bucket_id = 'content-media'
    and exists (select 1 from public.admin_roles where user_id = auth.uid())
  );

create policy "admins delete content-media"
  on storage.objects for delete
  using (
    bucket_id = 'content-media'
    and exists (select 1 from public.admin_roles where user_id = auth.uid())
  );

alter table public.culture_items add column image_url text;

-- Deliberately separate from admin_upsert_culture_item rather than adding
-- a 21st parameter to it - keeps that function's signature (and every
-- existing call site/client mapping) untouched, and image upload is a
-- genuinely different action (a Storage write + a URL write) from the
-- plain-field edits the generic admin form already handles.
create function public.admin_set_culture_item_image(p_id text, p_image_url text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select image_url into v_before from public.culture_items where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  update public.culture_items set image_url = p_image_url where id = p_id;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (
    auth.uid(), 'set_image', 'culture_items', p_id,
    jsonb_build_object('image_url', v_before), jsonb_build_object('image_url', p_image_url)
  );
end;
$$;
grant execute on function public.admin_set_culture_item_image(text, text) to authenticated;
