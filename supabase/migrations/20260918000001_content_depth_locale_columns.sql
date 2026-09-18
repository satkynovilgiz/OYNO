-- Age-aware content depth needs to support KG/RU/EN (spec "Ensure KG/RU/EN
-- architecture supports these variants. Do not fake translations if
-- verified/localized text does not exist."). The single `simple_summary`
-- column added in 20260917000001 was Kyrgyz-only, matching how every other
-- culture_items field already worked - this migration gives the *simple*
-- depth tier the same three-column shape culture_categories/discoveries
-- already use for other localized text (name_kg/name_ru/name_en), without
-- inventing ru/en translations that don't exist yet: both new columns
-- start null, and the app falls back to the existing Kyrgyz-only full
-- field breakdown for ru/en readers until real translations are authored.
alter table public.culture_items rename column simple_summary to simple_summary_kg;
alter table public.culture_items add column simple_summary_ru text;
alter table public.culture_items add column simple_summary_en text;
