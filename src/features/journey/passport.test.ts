import type { ExploreRegionRow } from '@/services/content/types';

import { buildPassport, newlyUnlockedStampIds } from './passport';

const region = (id: string, kind: 'region' | 'nature', en: string) =>
  ({ id, kind, name_kg: `${en} kg`, name_ru: `${en} ru`, name_en: en }) as ExploreRegionRow;

const regions = [
  region('naryn', 'region', 'Naryn'),
  region('son-kol', 'nature', 'Son-Kol'),
  region('suusamyr', 'nature', 'Suusamyr'),
  region('ala-too', 'nature', 'Ala-Too'),
];

describe('buildPassport', () => {
  it('has one stamp per nature destination only, all locked for a new user', () => {
    const passport = buildPassport(regions, [], {}, () => undefined, 'en');
    expect(passport.stamps.map((stamp) => stamp.id)).toEqual(['son-kol', 'suusamyr', 'ala-too']);
    expect(passport).toMatchObject({ unlocked: 0, total: 3, isComplete: false });
    expect(passport.stamps.every((stamp) => !stamp.unlocked && stamp.visitedAt === null)).toBe(true);
  });

  it('unlocks only visited destinations and never invents a date', () => {
    const passport = buildPassport(regions, ['son-kol', 'suusamyr', 'naryn'], { 'son-kol': '2026-09-20T10:00:00Z' }, () => undefined, 'ru');
    expect(passport.unlocked).toBe(2);
    expect(passport.stamps[0]).toMatchObject({ id: 'son-kol', title: 'Son-Kol ru', unlocked: true, visitedAt: '2026-09-20T10:00:00Z', route: '/explore/son-kol' });
    expect(passport.stamps[1]).toMatchObject({ id: 'suusamyr', unlocked: true, visitedAt: null });
    expect(passport.stamps[2]).toMatchObject({ id: 'ala-too', unlocked: false });
  });

  it('keeps the destination tone index the Explore card uses', () => {
    const passport = buildPassport(regions, [], {}, () => undefined, 'en');
    expect(passport.stamps.map((stamp) => stamp.toneIndex)).toEqual([0, 1, 2]);
  });

  it('is complete only when every destination is visited', () => {
    expect(buildPassport(regions, ['son-kol', 'suusamyr', 'ala-too'], {}, () => undefined, 'en').isComplete).toBe(true);
    expect(buildPassport([], [], {}, () => undefined, 'en').isComplete).toBe(false);
  });
});

describe('newlyUnlockedStampIds', () => {
  it('returns unlocked stamps not seen before', () => {
    const passport = buildPassport(regions, ['son-kol', 'suusamyr'], {}, () => undefined, 'en');
    expect(newlyUnlockedStampIds(passport, ['son-kol'])).toEqual(['suusamyr']);
    expect(newlyUnlockedStampIds(passport, ['son-kol', 'suusamyr'])).toEqual([]);
  });
});
