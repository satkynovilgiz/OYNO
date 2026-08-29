import { AVATAR_CATALOG } from './avatarCatalog';
import { AVATAR_UNLOCK_RULES, getUnlockedItemIds, isItemUnlocked, type AvatarUnlockProgressSnapshot } from './avatarUnlocks';

const ZERO_PROGRESS: AvatarUnlockProgressSnapshot = {
  gamesPlayed: 0,
  cultureDiscoveryCount: 0,
  questFoundCount: 0,
  streakDays: 0,
  xp: 0,
};

function findItem(id: string) {
  for (const categoryItems of Object.values(AVATAR_CATALOG)) {
    const found = categoryItems.find((item) => item.id === id);
    if (found) return found;
  }
  throw new Error(`fixture error: no catalog item with id ${id}`);
}

describe('avatarUnlocks', () => {
  it('every free item is unlocked regardless of a zero-progress snapshot', () => {
    const unlocked = getUnlockedItemIds(AVATAR_CATALOG, ZERO_PROGRESS);
    for (const categoryItems of Object.values(AVATAR_CATALOG)) {
      for (const item of categoryItems) {
        if (item.unlock.type === 'free') expect(unlocked.has(item.id)).toBe(true);
      }
    }
  });

  it('hair_10 unlocks at exactly 10 games played, not below', () => {
    const item = findItem('hair_10');
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, gamesPlayed: 9 })).toBe(false);
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, gamesPlayed: 10 })).toBe(true);
  });

  it('chapan unlocks at exactly 1 culture discovery, not below', () => {
    const item = findItem('chapan');
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, cultureDiscoveryCount: 0 })).toBe(false);
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, cultureDiscoveryCount: 1 })).toBe(true);
  });

  it('shokulo unlocks at exactly 5 quests found, not below', () => {
    const item = findItem('shokulo');
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, questFoundCount: 4 })).toBe(false);
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, questFoundCount: 5 })).toBe(true);
  });

  it('shyrdakPattern unlocks at exactly a 3-day streak, not below', () => {
    const item = findItem('shyrdakPattern');
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, streakDays: 2 })).toBe(false);
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, streakDays: 3 })).toBe(true);
  });

  it('ornamentalPin unlocks at level 5 (2000 XP), not one level below', () => {
    const item = findItem('ornamentalPin');
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, xp: 1999 })).toBe(false); // level 4
    expect(isItemUnlocked(item, { ...ZERO_PROGRESS, xp: 2000 })).toBe(true); // level 5
  });

  it('a snapshot meeting every threshold unlocks all 5 gated items', () => {
    const maxedProgress: AvatarUnlockProgressSnapshot = {
      gamesPlayed: 10,
      cultureDiscoveryCount: 1,
      questFoundCount: 5,
      streakDays: 3,
      xp: 2000,
    };
    const unlocked = getUnlockedItemIds(AVATAR_CATALOG, maxedProgress);
    for (const rule of AVATAR_UNLOCK_RULES) {
      const itemId = rule.ruleId.split(':')[1];
      expect(unlocked.has(itemId)).toBe(true);
    }
  });
});
