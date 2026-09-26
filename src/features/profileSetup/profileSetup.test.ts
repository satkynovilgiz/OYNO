/**
 * Profile setup: name -> Story Companion (guide) -> the user's avatar.
 * The guide and the avatar are separate data and must never overwrite
 * each other. Store network calls are mocked; the stores themselves, the
 * avatar catalog, unlock rules, randomizer and sanitizer are real.
 */
import { ALL_CHARACTER_IDS, CHARACTERS_WITH_FULL_SHEET } from '@/components/character/characterAssets';
import { AVATAR_CATALOG, sanitizeAvatarConfig } from '@/services/avatar/avatarCatalog';
import { HAIR_COLOR_SWATCHES, SKIN_TONE_SWATCHES, swatchCheckColor } from '@/services/avatar/avatarColors';
import { getUnlockedItemIds } from '@/services/avatar/avatarUnlocks';
import { createDefaultAvatarConfig } from '@/services/avatar/defaultAvatar';
import { randomizeAvatar } from '@/services/avatar/randomizeAvatar';
import { useAppStore } from '@/store/useAppStore';
import { useAvatarStore } from '@/store/useAvatarStore';

import { displayNameError, isSelectableCompanion, PROFILE_SETUP_STEPS, stepNumber } from './profileSetupModel';

jest.mock('@/services/supabase/client', () => ({
  supabase: { from: jest.fn(() => ({ upsert: jest.fn(() => Promise.resolve({ error: null })), update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) })) },
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest', user: null }) } }));
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));

const ZERO_PROGRESS = getUnlockedItemIds(AVATAR_CATALOG, { gamesPlayed: 0, cultureDiscoveryCount: 0, questFoundCount: 0, streakDays: 0, xp: 0 });

describe('profile setup flow', () => {
  it('runs name -> guide -> avatar, three steps', () => {
    expect(PROFILE_SETUP_STEPS).toEqual(['name', 'character', 'avatar']);
    expect(PROFILE_SETUP_STEPS.map(stepNumber)).toEqual([1, 2, 3]);
  });

  it('display name: only rule is non-empty (no invented username rules)', () => {
    expect(displayNameError('   ')).toBe('profileSetup.nameError');
    expect(displayNameError('Айпери')).toBeNull();
    expect(displayNameError('a')).toBeNull();
    expect(displayNameError('Бек 2008 ✨')).toBeNull();
  });

  it('only guides with a complete character sheet can be confirmed', () => {
    expect(isSelectableCompanion('bek')).toBe(true);
    expect(isSelectableCompanion(null)).toBe(false);
    const unavailable = ALL_CHARACTER_IDS.filter((id) => !CHARACTERS_WITH_FULL_SHEET.includes(id));
    expect(unavailable.length).toBeGreaterThan(0);
    for (const id of unavailable) expect(isSelectableCompanion(id)).toBe(false);
  });
});

describe('avatar step', () => {
  it('Skip saves the real default avatar, made only of items a brand-new account owns', () => {
    const fallback = createDefaultAvatarConfig();
    expect(sanitizeAvatarConfig(fallback)).toEqual(fallback);
    for (const categoryId of Object.keys(AVATAR_CATALOG) as (keyof typeof AVATAR_CATALOG)[]) {
      const chosen = (fallback as Record<string, unknown>)[categoryId];
      if (typeof chosen === 'string') expect(ZERO_PROGRESS.has(chosen)).toBe(true);
    }
  });

  it('Randomize only ever picks unlocked items (never a progression-gated cosmetic)', () => {
    let config = createDefaultAvatarConfig();
    for (let run = 0; run < 50; run++) {
      config = randomizeAvatar(config, { unlockedItemIds: ZERO_PROGRESS });
      for (const categoryId of Object.keys(AVATAR_CATALOG)) {
        const chosen = (config as Record<string, unknown>)[categoryId];
        if (typeof chosen === 'string') expect(ZERO_PROGRESS.has(chosen)).toBe(true);
      }
      expect(sanitizeAvatarConfig(config)).toEqual(config);
    }
  });

  it('a new account really has locked items (not everything is free)', () => {
    const all = Object.values(AVATAR_CATALOG).flat();
    expect(all.some((item) => !ZERO_PROGRESS.has(item.id))).toBe(true);
  });

  it('the selected-swatch check stays visible on light and dark colours', () => {
    expect(swatchCheckColor(SKIN_TONE_SWATCHES[0].hex)).toBe('#1E1A16');
    expect(swatchCheckColor(HAIR_COLOR_SWATCHES.find((s) => s.id === 'white')!.hex)).toBe('#1E1A16');
    expect(swatchCheckColor(HAIR_COLOR_SWATCHES.find((s) => s.id === 'black')!.hex)).toBe('#FFFFFF');
  });
});

describe('guide and avatar stay independent', () => {
  it('changing the guide never touches the avatar, and saving the avatar never changes the guide', async () => {
    const avatar = randomizeAvatar(createDefaultAvatarConfig(), { unlockedItemIds: ZERO_PROGRESS });
    await useAvatarStore.getState().save(avatar);
    const savedAvatar = useAvatarStore.getState().config;

    useAppStore.getState().setCharacterId('aidana');
    expect(useAvatarStore.getState().config).toEqual(savedAvatar);

    await useAvatarStore.getState().save(createDefaultAvatarConfig());
    expect(useAppStore.getState().characterId).toBe('aidana');
  });

  it('a saved avatar round-trips through persistence unchanged', async () => {
    const avatar = randomizeAvatar(createDefaultAvatarConfig(), { unlockedItemIds: ZERO_PROGRESS });
    expect(await useAvatarStore.getState().save(avatar)).toBe(true);
    expect(useAvatarStore.getState().config).toEqual(sanitizeAvatarConfig(avatar));
    expect(useAvatarStore.getState().hasEverSaved).toBe(true);
  });
});
