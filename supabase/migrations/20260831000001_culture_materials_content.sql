-- Culture Interactive Experience V1: "New materials" fix (see the audit -
-- the item-detail route already works fine, culture_materials just had no
-- body-content columns to navigate to, so NewMaterialsRow's tap handler
-- was an Alert-only dead end). This adds real content columns and extends
-- the admin RPC to manage them, following the same shape/pattern already
-- used for culture_items.
--
-- Body content for the 3 existing rows below is from a short web-research
-- pass (ky.wikipedia.org + kg-language culture sites), same honesty
-- standard as 20260829000005_boz_uy_oymo_shyrdak_content.sql - marked
-- 'partially_verified' rather than 'verified' since it's a single shallow
-- pass, not cross-checked research.

alter table public.culture_materials
  add column body text,
  add column accuracy_level text not null default 'unverified'
    check (accuracy_level in ('verified', 'partially_verified', 'unverified')),
  add column sources text[],
  add column image_url text;

create or replace function public.admin_upsert_culture_material(
  p_id text, p_kind text, p_title text, p_description text, p_duration_minutes int, p_sort_order int,
  p_body text default null, p_accuracy_level text default 'unverified', p_sources text[] default null
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

  insert into public.culture_materials (id, kind, title, description, duration_minutes, sort_order, body, accuracy_level, sources)
  values (p_id, p_kind, p_title, p_description, p_duration_minutes, p_sort_order, p_body, p_accuracy_level, p_sources)
  on conflict (id) do update set
    kind = excluded.kind,
    title = excluded.title,
    description = excluded.description,
    duration_minutes = excluded.duration_minutes,
    sort_order = excluded.sort_order,
    body = excluded.body,
    accuracy_level = excluded.accuracy_level,
    sources = excluded.sources
  returning * into v_row;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), case when v_before is null then 'create' else 'update' end, 'culture_materials', p_id, v_before, to_jsonb(v_row));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_culture_material(text, text, text, text, int, int, text, text, text[]) to authenticated;

-- Mirrors admin_set_culture_item_image (20260829000007_storage_pipeline.sql)
-- exactly - same content-media bucket, same admin-role gate, same
-- deliberately-separate-function reasoning (image upload is a Storage
-- write + URL write, not a plain-field edit).
create function public.admin_set_culture_material_image(p_id text, p_image_url text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before text;
begin
  perform public.require_admin_role(array['super_admin', 'content_editor']);
  select image_url into v_before from public.culture_materials where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  update public.culture_materials set image_url = p_image_url where id = p_id;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, before, after)
  values (
    auth.uid(), 'set_image', 'culture_materials', p_id,
    jsonb_build_object('image_url', v_before), jsonb_build_object('image_url', p_image_url)
  );
end;
$$;
grant execute on function public.admin_set_culture_material_image(text, text) to authenticated;

update public.culture_materials set
  body = 'Комуз - кыргыздын эң байыркы үч кылдуу чертме музыкалык аспабы. Ал окумуштуу Махмуд Кашкаринин XI кылымда жазылган "Дивану лугат-ат-түрк" сөздүгүндө эскерилет. Комуз өрүк, кара жыгач, карагай сыяктуу жыгач түрлөрүнөн оюлуп жасалат жана баш, моюн, корпус, кутуча, тагоо жана үч кылдан турат. 1935-жылы Москвада комуздун жаңы түрлөрү (прима, секунда, альт, тенор, бас) иштелип чыккан.',
  accuracy_level = 'partially_verified',
  sources = array[
    'https://ky.wikipedia.org/wiki/%D0%9A%D0%BE%D0%BC%D1%83%D0%B7',
    'https://kutbilim.kg/methodical/inner/147019/'
  ]
where id = 'komuz-discovery';

update public.culture_materials set
  body = 'Ак калпак - кыргыз элинин алыстан таанылган салттуу баш кийими, анын тарыхы кыргыз элинин тарыхы менен тете эски. Кыргыз элинин каада-салтында калпакты байыртан бери аялдар токуп, энеден кызга калтырышкан. Ак калпак кыргыз элинин намысынын, сыймыгынын жана тарыхынын белгиси катары каралат.',
  accuracy_level = 'partially_verified',
  sources = array[
    'https://ky.wikipedia.org/wiki/%D0%9A%D0%B0%D0%BB%D0%BF%D0%B0%D0%BA',
    'https://kutbilim.kg/methodical/inner/kyrgyzdyn-zh-z-ak-kalpak/'
  ]
where id = 'kalpak-history';

update public.culture_materials set
  body = 'Боорсок - майда ромб же төрт бурчтук түрүндө кесилип, кайнап турган майда кызартылган кыргыздын салттуу нан тагамы. Ачыган жумшак камыр жука (болжол менен 0,5 см) жайылып, тилке-тилке кесилет, андан соң бөлүктөргө бөлүнүп, кайнап турган майга салынып, алтын түскө чейин кызартылат. Боорсок майрамдарда жана тойлордо даярдалып, чай, кымыз же шорпо менен коштолуп берилет.',
  accuracy_level = 'partially_verified',
  sources = array[
    'https://kmb3.kloop.asia/2011/09/10/boorsok/',
    'https://open.kg/ky/about-kyrgyzstan/culture/kyrgyz-cuisine/flour-products/35459-boorsok-baursaki.html'
  ]
where id = 'boorsok-cooking';
