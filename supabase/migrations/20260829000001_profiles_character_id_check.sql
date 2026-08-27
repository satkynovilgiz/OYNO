-- Hardening noted in the QA audit: character_id had no CHECK constraint and
-- its RLS update policy has no WITH CHECK, so once the client starts writing
-- this column (this migration ships alongside that client change), nothing
-- server-side stopped a crafted request from writing an arbitrary string.
-- Restrict to the actual set of character ids the app knows about
-- (src/components/character/characterAssets.ts's ALL_CHARACTER_IDS) - this
-- doesn't gate "complete" vs "coming soon" characters, since picking an
-- incomplete one is a cosmetic placeholder-avatar case, not a security
-- concern, only genuinely invalid values.

alter table public.profiles
  add constraint profiles_character_id_valid
  check (character_id in ('bek', 'aidana', 'aiana', 'boru', 'tulpar', 'elchi'));
