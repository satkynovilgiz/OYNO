import { toggleWallpaperId } from '@/store/useWallpaperFavoritesStore';

import { buildWidgetSnapshot, type WidgetSnapshotInput } from './widgetSnapshot';

const base: WidgetSnapshotInput = {
  language: 'kg',
  now: new Date('2026-09-23T08:00:00Z'),
  localDate: '2026-09-23',
  labels: {
    daily: 'Күндүн ачылышы',
    dailyDone: 'Бүгүн ачылды',
    minutes: '1 мүнөт',
    journey: 'Саякатыңды улант',
    passport: 'Паспорт',
    passportProgress: '6 жерден 2 ачылды',
    trail: 'Саякат',
    noTrail: 'Азырынча саякат башталган жок',
    cultureOfDay: 'Күндүн маданияты',
    openApp: 'OYNOну ач',
  },
  daily: { itemId: 'boz-uy-kiyiz-jabuu', title: 'Кийиз жабуулар', minutes: 1, isCompleted: false },
  journey: { eyebrow: 'Бүгүн', title: 'Кийиз жабуулар', progress: null, route: '/daily' },
  passport: { unlocked: 2, total: 6 },
  trails: [
    { id: 'horse-culture', title: 'Ат маданияты', status: 'unstarted', completed: 0, total: 2 },
    { id: 'nomad-life', title: 'Көчмөн турмушу', status: 'inProgress', completed: 1, total: 4 },
  ],
  cultureMaterials: [
    { id: 'kalpak-history', kind: 'reading', title: 'Калпак', description: null },
    { id: 'komuz-discovery', kind: 'today_discovery', title: 'Комуз', description: 'Кыргыздын улуттук аспабы' },
  ],
};

describe('buildWidgetSnapshot', () => {
  it('passes real values through unchanged', () => {
    const snapshot = buildWidgetSnapshot(base);
    expect(snapshot.passport).toEqual({ unlocked: 2, total: 6 });
    expect(snapshot.daily).toEqual(base.daily);
    expect(snapshot.generatedAt).toBe('2026-09-23T08:00:00.000Z');
  });

  it('uses the first trail actually in progress, never an unstarted one', () => {
    expect(buildWidgetSnapshot(base).trail).toEqual({ id: 'nomad-life', title: 'Көчмөн турмушу', completed: 1, total: 4 });
    expect(buildWidgetSnapshot({ ...base, trails: [base.trails[0]] }).trail).toBeNull();
  });

  it('takes Culture of the Day from the real today_discovery material only', () => {
    expect(buildWidgetSnapshot(base).cultureOfDay?.id).toBe('komuz-discovery');
    expect(buildWidgetSnapshot({ ...base, cultureMaterials: [base.cultureMaterials[0]] }).cultureOfDay).toBeNull();
  });

  it('points every widget at a real route', () => {
    expect(buildWidgetSnapshot(base).routes).toEqual({
      daily: '/daily',
      journey: '/daily',
      passport: '/journey',
      trail: '/trails/nomad-life',
      cultureOfDay: '/culture/material/komuz-discovery',
    });
  });

  it('is JSON-serializable for a native widget extension', () => {
    const snapshot = buildWidgetSnapshot(base);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe('toggleWallpaperId', () => {
  it('adds and removes a favorite', () => {
    expect(toggleWallpaperId([], 'son-kol')).toEqual(['son-kol']);
    expect(toggleWallpaperId(['son-kol', 'alay'], 'son-kol')).toEqual(['alay']);
  });
});
