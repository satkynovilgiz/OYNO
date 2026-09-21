-- Generalizes user_favorites from "region/nature only" (its original
-- Explore-2.0-era scope, 20260901000002_explore_v2.sql) to every content
-- type the app can now favorite (spec "Turn OYNO Favorites into a real
-- cross-app saved collection... Do not let Games, Culture and Explore
-- maintain incompatible favorite systems"). The table shape and the
-- toggle_favorite() RPC already worked for any (target_type, target_id)
-- pair - the only thing actually scoping it to two kinds was this CHECK
-- constraint, so that's the only thing that needs to change. Existing
-- rows (real users' region/nature favorites) are untouched and keep
-- working exactly as before.
alter table public.user_favorites drop constraint if exists user_favorites_target_type_check;

alter table public.user_favorites add constraint user_favorites_target_type_check
  check (target_type in ('region', 'nature', 'game', 'culture_material', 'culture_item', 'interactive_experience'));
