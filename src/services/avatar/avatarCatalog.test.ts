import { AVATAR_CATALOG, applySelection, isCompatible, sanitizeAvatarConfig } from './avatarCatalog';
import { AVATAR_CATEGORY_IDS } from './avatarConfig';
import { DEFAULT_AVATAR_CONFIG } from './defaultAvatar';

// Hard product requirement: these must NEVER contain a locked item.
const ALWAYS_FREE_CATEGORIES = ['base', 'faceShape', 'eyebrows', 'nose', 'mouth', 'body', 'eyes'] as const;

describe('AVATAR_CATALOG', () => {
  it('has at least one item in every category', () => {
    for (const categoryId of AVATAR_CATEGORY_IDS) {
      expect(AVATAR_CATALOG[categoryId].length).toBeGreaterThan(0);
    }
  });

  it.each(ALWAYS_FREE_CATEGORIES)('every item in the "%s" core-identity category is free', (categoryId) => {
    const locked = AVATAR_CATALOG[categoryId].filter((item) => item.unlock.type !== 'free');
    expect(locked).toEqual([]);
  });

  it('every category has at least one free starter item', () => {
    for (const categoryId of AVATAR_CATEGORY_IDS) {
      const hasFree = AVATAR_CATALOG[categoryId].some((item) => item.unlock.type === 'free');
      expect(hasFree).toBe(true);
    }
  });

  it('the default avatar config only ever references free items', () => {
    for (const categoryId of AVATAR_CATEGORY_IDS) {
      const selectedId = DEFAULT_AVATAR_CONFIG[categoryId];
      const item = AVATAR_CATALOG[categoryId].find((candidate) => candidate.id === selectedId);
      expect(item?.unlock.type).toBe('free');
    }
  });
});

describe('isCompatible / applySelection (headwear x hair MVP rule)', () => {
  it('flags a full-coverage headwear item as incompatible with long hair', () => {
    const config = { ...DEFAULT_AVATAR_CONFIG, hair: 'braid_01' as const };
    expect(isCompatible(config, 'headwear', 'shokulo')).toBe(false);
  });

  it('resets hair to the starter style when a conflicting headwear is applied', () => {
    const config = { ...DEFAULT_AVATAR_CONFIG, hair: 'braid_01' as const };
    const result = applySelection(config, 'headwear', 'shokulo');
    expect(result.headwear).toBe('shokulo');
    expect(result.hair).toBe('hair_01');
  });

  it('resets headwear to the starter style when a conflicting long hairstyle is applied', () => {
    const config = { ...DEFAULT_AVATAR_CONFIG, headwear: 'shokulo' as const };
    const result = applySelection(config, 'hair', 'braid_02');
    expect(result.hair).toBe('braid_02');
    expect(result.headwear).toBe('none');
  });

  it('leaves an unrelated selection alone (no false-positive conflict)', () => {
    const result = applySelection(DEFAULT_AVATAR_CONFIG, 'clothing', 'sweater');
    expect(result.clothing).toBe('sweater');
    expect(result.hair).toBe(DEFAULT_AVATAR_CONFIG.hair);
    expect(result.headwear).toBe(DEFAULT_AVATAR_CONFIG.headwear);
  });
});

describe('sanitizeAvatarConfig (catalog-aware)', () => {
  it('falls back to the default for an id that does not exist in any catalog category', () => {
    const result = sanitizeAvatarConfig({ faceShape: 'not_a_real_id' as never });
    expect(result.faceShape).toBe(DEFAULT_AVATAR_CONFIG.faceShape);
  });

  it('accepts a real catalog id for every field', () => {
    const result = sanitizeAvatarConfig({ faceShape: 'square', clothing: 'sweater' });
    expect(result.faceShape).toBe('square');
    expect(result.clothing).toBe('sweater');
  });
});
