import type { CultureItemRow } from '@/services/content/types';

import { buildImageChallenge, dailyDiscoveryPool, dayNumber, estimateReadMinutes, localDateKey, pickDailyDiscovery } from './dailyDiscovery';

function item(id: string, overrides: Partial<CultureItemRow> = {}): CultureItemRow {
  return {
    id,
    category_id: id.split('-')[0],
    subgroup: null,
    title: id,
    alt_names: null,
    type_label: null,
    origin: null,
    history: null,
    cultural_meaning: `Meaning of ${id}.`,
    when_used: null,
    ingredients: null,
    traditional_method: null,
    who_participates: null,
    objects_used: null,
    regional_notes: null,
    modern_status: null,
    fun_facts: null,
    simple_summary_kg: null,
    simple_summary_ru: null,
    simple_summary_en: null,
    accuracy_level: 'partially_verified',
    sources: null,
    sort_order: 0,
    image_url: null,
    ...overrides,
  };
}

const IMAGES: Record<string, string> = {
  'boz-a': 'img-boz-a',
  'boz-b': 'img-boz-b',
  'horse-a': 'img-horse-a',
  'horse-b': 'img-horse-b',
  'clothing-a': 'img-shared',
  'clothing-b': 'img-shared',
  'oymo-a': 'img-oymo-a',
};
const hasImage = (id: string) => !!IMAGES[id];
const imageOf = (id: string) => IMAGES[id];

describe('localDateKey', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});

describe('dailyDiscoveryPool', () => {
  it('only includes items with a photo, real text, and not unverified', () => {
    const pool = dailyDiscoveryPool(
      [
        item('boz-a'),
        item('boz-b', { accuracy_level: 'unverified' }),
        item('horse-a', { cultural_meaning: null }),
        item('no-image'),
        item('horse-b', { cultural_meaning: null, fun_facts: 'A real fact.' }),
      ],
      hasImage,
    );
    expect(pool.map((row) => row.id).sort()).toEqual(['boz-a', 'horse-b']);
  });

  it('is order-independent', () => {
    const rows = [item('boz-a'), item('horse-a'), item('oymo-a')];
    const forward = dailyDiscoveryPool(rows, hasImage).map((row) => row.id);
    const reversed = dailyDiscoveryPool([...rows].reverse(), hasImage).map((row) => row.id);
    expect(forward).toEqual(reversed);
  });
});

describe('pickDailyDiscovery', () => {
  const pool = dailyDiscoveryPool([item('boz-a'), item('boz-b'), item('horse-a'), item('oymo-a')], hasImage);

  it('returns null for an empty pool', () => {
    expect(pickDailyDiscovery([], '2026-09-22')).toBeNull();
  });

  it('is stable for the same date', () => {
    expect(pickDailyDiscovery(pool, '2026-09-22')).toBe(pickDailyDiscovery(pool, '2026-09-22'));
  });

  it('cycles through every item before repeating', () => {
    const start = dayNumber('2026-09-22');
    const seen = new Set<string>();
    for (let offset = 0; offset < pool.length; offset += 1) {
      const date = new Date((start + offset) * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      seen.add(pickDailyDiscovery(pool, key)!.id);
    }
    expect(seen.size).toBe(pool.length);
  });
});

describe('estimateReadMinutes', () => {
  it('clamps to 1-3 minutes', () => {
    expect(estimateReadMinutes([])).toBe(1);
    expect(estimateReadMinutes(['word '.repeat(200)])).toBe(2);
    expect(estimateReadMinutes(['word '.repeat(5000)])).toBe(3);
  });
});

describe('buildImageChallenge', () => {
  const pool = [item('boz-a'), item('boz-b'), item('horse-a'), item('clothing-a'), item('clothing-b'), item('oymo-a')];

  it('has exactly one correct option, the answer itself', () => {
    const options = buildImageChallenge(pool[0], pool, '2026-09-22', imageOf);
    expect(options).toHaveLength(3);
    expect(options.filter((option) => option.correct)).toEqual([{ itemId: 'boz-a', correct: true }]);
  });

  it('never shows the same photo twice', () => {
    const options = buildImageChallenge(item('clothing-a'), pool, '2026-09-22', imageOf);
    const images = options.map((option) => imageOf(option.itemId));
    expect(new Set(images).size).toBe(images.length);
  });

  it('prefers distractors from other categories', () => {
    const options = buildImageChallenge(pool[0], pool, '2026-09-22', imageOf);
    const distractors = options.filter((option) => !option.correct).map((option) => option.itemId);
    expect(distractors.some((id) => id.startsWith('boz'))).toBe(false);
  });
});
