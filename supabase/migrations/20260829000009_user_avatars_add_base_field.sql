-- Adds the new `base` field (spec section 1's "gender / base character")
-- to user_avatars' default config, in lockstep with DEFAULT_AVATAR_CONFIG
-- in src/services/avatar/defaultAvatar.ts (same hand-kept-in-sync
-- convention the original 20260829000008 migration documents).
--
-- Only changes the column default (applies to NEW rows going forward,
-- i.e. new signups via handle_new_user_avatar()). Existing rows' `config`
-- simply lacks a `base` key - harmless, since avatarCatalog.ts's
-- sanitizeAvatarConfig() already fills any missing/invalid field from
-- DEFAULT_AVATAR_CONFIG on every read, so an existing account sees
-- base:"male" the first time it loads without any backfill needed here.

alter table public.user_avatars
  alter column config set default '{
    "version": 1,
    "base": "male",
    "skinTone": "skin_03",
    "faceShape": "oval",
    "body": "average",
    "eyes": "round",
    "eyeColor": "brown",
    "eyebrows": "straight",
    "nose": "default",
    "mouth": "neutral",
    "hair": "hair_01",
    "hairColor": "black",
    "headwear": "none",
    "clothing": "hoodie",
    "accessory": "none",
    "background": "beige"
  }'::jsonb;
