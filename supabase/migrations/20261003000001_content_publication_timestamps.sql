-- What's New 1.0 - real publication / content-update timestamps.
--
-- culture_items and culture_materials had NO timestamps, so OYNO could not
-- honestly say what is new. This adds them WITHOUT inventing history:
--
--   published_at        set when a row is INSERTED from now on. Existing
--                       rows stay NULL (their real publication time is
--                       unknown) and are never shown as "new".
--   content_updated_at  set when an AUTHORED field actually changes (title,
--                       body/fields, simple summaries) - not on sort order,
--                       images, verification or any other column.
--   update_note         optional, admin-authored public changelog line
--                       (never generated). NULL = show only "Updated on".
--
-- Both tables are already public-read; nothing private is added.

alter table public.culture_items add column if not exists published_at timestamptz;
alter table public.culture_items add column if not exists content_updated_at timestamptz;
alter table public.culture_items add column if not exists update_note text check (update_note is null or char_length(update_note) <= 240);
alter table public.culture_items alter column published_at set default now();

alter table public.culture_materials add column if not exists published_at timestamptz;
alter table public.culture_materials add column if not exists content_updated_at timestamptz;
alter table public.culture_materials add column if not exists update_note text check (update_note is null or char_length(update_note) <= 240);
alter table public.culture_materials alter column published_at set default now();

create or replace function public.touch_culture_item_content()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.origin, new.history, new.cultural_meaning, new.when_used, new.ingredients, new.traditional_method,
      new.who_participates, new.objects_used, new.regional_notes, new.modern_status, new.fun_facts,
      new.simple_summary_kg, new.simple_summary_ru, new.simple_summary_en)
     is distinct from
     (old.title, old.origin, old.history, old.cultural_meaning, old.when_used, old.ingredients, old.traditional_method,
      old.who_participates, old.objects_used, old.regional_notes, old.modern_status, old.fun_facts,
      old.simple_summary_kg, old.simple_summary_ru, old.simple_summary_en) then
    new.content_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists culture_items_content_updated on public.culture_items;
create trigger culture_items_content_updated before update on public.culture_items
  for each row execute function public.touch_culture_item_content();

create or replace function public.touch_culture_material_content()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.description, new.body) is distinct from (old.title, old.description, old.body) then
    new.content_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists culture_materials_content_updated on public.culture_materials;
create trigger culture_materials_content_updated before update on public.culture_materials
  for each row execute function public.touch_culture_material_content();
