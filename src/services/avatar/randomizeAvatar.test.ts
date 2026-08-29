import { AVATAR_CATALOG, getStarterItemId } from './avatarCatalog';
import { AVATAR_CATEGORY_IDS, isValidAvatarConfig, type AvatarConfig } from './avatarConfig';
import { DEFAULT_AVATAR_CONFIG } from './defaultAvatar';
import { randomizeAvatar } from './randomizeAvatar';

const ALL_ITEM_IDS = new Set(Object.values(AVATAR_CATALOG).flatMap((list) => list.map((item) => item.id)));
const ONLY_STARTERS = new Set(AVATAR_CATEGORY_IDS.map((categoryId) => getStarterItemId(categoryId)));

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('randomizeAvatar', () => {
  it('always returns a valid AvatarConfig', () => {
    const result = randomizeAvatar(DEFAULT_AVATAR_CONFIG, { unlockedItemIds: ALL_ITEM_IDS });
    expect(isValidAvatarConfig(result)).toBe(true);
  });

  it('never picks a locked (not-yet-unlocked) item', () => {
    const result = randomizeAvatar(DEFAULT_AVATAR_CONFIG, { unlockedItemIds: ONLY_STARTERS, rng: () => 0.99 });
    for (const categoryId of AVATAR_CATEGORY_IDS) {
      expect(ONLY_STARTERS.has(result[categoryId])).toBe(true);
    }
  });

  it('never changes a locked category', () => {
    const current: AvatarConfig = { ...DEFAULT_AVATAR_CONFIG, clothing: 'sweater' };
    const result = randomizeAvatar(current, {
      unlockedItemIds: ALL_ITEM_IDS,
      lockedCategories: new Set(['clothing']),
      rng: () => 0.99,
    });
    expect(result.clothing).toBe('sweater');
  });

  it('is deterministic given an injected rng', () => {
    const rngValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35, 0.45, 0.55];
    const first = randomizeAvatar(DEFAULT_AVATAR_CONFIG, { unlockedItemIds: ALL_ITEM_IDS, rng: sequenceRng(rngValues) });
    const second = randomizeAvatar(DEFAULT_AVATAR_CONFIG, { unlockedItemIds: ALL_ITEM_IDS, rng: sequenceRng(rngValues) });
    expect(second).toEqual(first);
  });

  it('always produces a compatible headwear/hair combination', () => {
    for (let i = 0; i < 20; i++) {
      const result = randomizeAvatar(DEFAULT_AVATAR_CONFIG, { unlockedItemIds: ALL_ITEM_IDS, rng: Math.random });
      const bothChosen =
        ['elechek', 'shokulo'].includes(result.headwear) &&
        ['braid_01', 'braid_02', 'bun_01', 'ponytail_01'].includes(result.hair);
      expect(bothChosen).toBe(false);
    }
  });
});
