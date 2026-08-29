import type { AvatarConfig } from './avatarConfig';

/**
 * Every field here must be a "starter" (unlock:{type:'free'}) item in
 * avatarCatalog.ts, and must match the jsonb default in
 * supabase/migrations/20260829000008_user_avatars.sql exactly - see that
 * migration's own comment on why these two have to be kept in lockstep
 * by hand (same known limitation useProgressStore.ts's DAILY_*_REWARD
 * constants already document for their own server/client duplication).
 */
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  version: 1,
  base: 'male',
  skinTone: 'skin_03',
  faceShape: 'oval',
  body: 'average',
  eyes: 'round',
  eyeColor: 'brown',
  eyebrows: 'straight',
  nose: 'default',
  mouth: 'neutral',
  hair: 'hair_01',
  hairColor: 'black',
  headwear: 'none',
  clothing: 'hoodie',
  accessory: 'none',
  background: 'beige',
};

export function createDefaultAvatarConfig(): AvatarConfig {
  return { ...DEFAULT_AVATAR_CONFIG };
}
