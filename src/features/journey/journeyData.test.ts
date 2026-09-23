import type { GameListItem } from '@/features/games/types';
import type { ProfileAchievement } from '@/features/profile/types';
import type { CultureItemRow, DiscoveryRow, ExploreRegionRow } from '@/services/content/types';

import {
  ALL_JOURNEY_SECTIONS,
  buildJourneySummary,
  getJourneySectionOrder,
  pickNextDiscovery,
  type JourneyCatalogs,
  type JourneyProgressInput,
} from './journeyData';

const t = (key: string) => key;
const detail = (played: number, won: number) => `${played}/${won}`;

const games = [
  { id: 'chuko', category: 'national', route: '/games/chuko' },
  { id: 'kok-boru', category: 'national', route: '/games/kok-boru' },
  { id: 'toguz-korgool', category: 'logic' },
] as unknown as GameListItem[];

const regions = [
  { id: 'naryn', kind: 'region', name_kg: 'Нарын', name_ru: 'Нарын', name_en: 'Naryn' },
  { id: 'osh', kind: 'region', name_kg: 'Ош', name_ru: 'Ош', name_en: 'Osh' },
  { id: 'ysyk-kol-lake', kind: 'nature', name_kg: 'Ысык-Көл', name_ru: 'Иссык-Куль', name_en: 'Issyk-Kul' },
] as unknown as ExploreRegionRow[];

const discoveries = [
  { id: 'too-teke', region_id: 'naryn', title_kg: 'Тоо теке', title_ru: 'Горный козёл', title_en: 'Ibex' },
] as unknown as DiscoveryRow[];

const achievements = [
  { id: 'first-win', titleKey: 'a.firstWin', iconSource: 1 },
  { id: 'traveler', titleKey: 'a.traveler', iconSource: 2 },
] as unknown as ProfileAchievement[];

const catalogs: JourneyCatalogs = {
  games,
  regions,
  discoveries,
  discoveryImages: {},
  achievements,
  cultureItems: [{ id: 'boz-uy-tunduk', title: 'Түндүк' } as CultureItemRow],
  cultureItemImage: () => undefined,
  dailyCompletions: {},
};

const empty: JourneyProgressInput = {
  gameStats: {},
  gamesPlayed: 0,
  visitedRegionIds: [],
  discoveredExploreIds: [],
  unlockedAchievementIds: [],
  bozUyVisited: false,
  oymoCreated: false,
  shyrdakCreated: false,
  komuzLessonCompleted: false,
  cultureDiscoveryCount: 0,
};

describe('buildJourneySummary', () => {
  it('shows honest zeros for a brand-new user', () => {
    const summary = buildJourneySummary(empty, catalogs, t, 'en', detail);
    expect(summary.totalStamps).toBe(0);
    expect(summary.played).toMatchObject({ distinctPlayed: 0, total: 2, sessions: 0 });
    expect(summary.explored).toMatchObject({ regionsVisited: 0, regionsTotal: 2, discoveriesFound: 0, discoveriesTotal: 1 });
    expect(summary.achievements).toMatchObject({ unlocked: 0, total: 2 });
    expect(summary.discovered.dailyItems).toEqual([]);
  });

  it('only counts playable games, and reads 3D stats by their recorded id', () => {
    const summary = buildJourneySummary({ ...empty, gamesPlayed: 4, gameStats: { kok_boru: { played: 3, won: 1 } } }, catalogs, t, 'en', detail);
    expect(summary.played.games.map((stamp) => stamp.id)).toEqual(['kok-boru', 'chuko']);
    expect(summary.played.games[0]).toMatchObject({ earned: true, detail: '3/1' });
    expect(summary.played.distinctPlayed).toBe(1);
  });

  it('stamps real regions/discoveries/achievements/experiences, earned first', () => {
    const summary = buildJourneySummary(
      {
        ...empty,
        visitedRegionIds: ['osh'],
        discoveredExploreIds: ['too-teke'],
        unlockedAchievementIds: ['traveler'],
        oymoCreated: true,
      },
      { ...catalogs, dailyCompletions: { '2026-09-21': 'boz-uy-tunduk', '2026-09-22': 'missing-item' } },
      t,
      'en',
      detail,
    );
    expect(summary.explored.regions.map((stamp) => [stamp.id, stamp.earned])).toEqual([
      ['osh', true],
      ['naryn', false],
    ]);
    expect(summary.explored.discoveries[0]).toMatchObject({ id: 'too-teke', title: 'Ibex', earned: true, route: '/explore/naryn' });
    expect(summary.achievements.stamps[0]).toMatchObject({ id: 'traveler', earned: true });
    expect(summary.discovered.experiences[0]).toMatchObject({ id: 'oymo', earned: true });
    // unknown item ids are skipped, never shown as a blank stamp
    expect(summary.discovered.dailyItems.map((stamp) => stamp.id)).toEqual(['boz-uy-tunduk']);
    expect(summary.totalStamps).toBe(1 + 1 + 1 + 1 + 1);
  });
});

describe('pickNextDiscovery', () => {
  const today = { id: 'boz-uy-tunduk', title: 'Түндүк', imageSource: null, earned: false, detail: null, route: '/daily' };

  it("suggests today's discovery first when it isn't done", () => {
    const summary = buildJourneySummary(empty, catalogs, t, 'en', detail);
    expect(pickNextDiscovery(summary, today)?.kind).toBe('daily');
  });

  it('falls through to an untried experience, then an unplayed game', () => {
    const summary = buildJourneySummary(empty, catalogs, t, 'en', detail);
    expect(pickNextDiscovery(summary, { ...today, earned: true })?.kind).toBe('experience');

    const allExperiences = { ...empty, bozUyVisited: true, oymoCreated: true, shyrdakCreated: true, komuzLessonCompleted: true };
    expect(pickNextDiscovery(buildJourneySummary(allExperiences, catalogs, t, 'en', detail), null)?.kind).toBe('game');
  });

  it('returns null once everything is genuinely done', () => {
    const everything: JourneyProgressInput = {
      ...empty,
      bozUyVisited: true,
      oymoCreated: true,
      shyrdakCreated: true,
      komuzLessonCompleted: true,
      gameStats: { chuko: { played: 1, won: 0 }, kok_boru: { played: 1, won: 0 } },
      visitedRegionIds: ['naryn', 'osh'],
    };
    expect(pickNextDiscovery(buildJourneySummary(everything, catalogs, t, 'en', detail), null)).toBeNull();
  });
});

describe('getJourneySectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)('%s renders every section exactly once', (experience) => {
    expect([...getJourneySectionOrder(experience)].sort()).toEqual([...ALL_JOURNEY_SECTIONS].sort());
  });

  it('reads like a journal for adults, with the suggestion last', () => {
    const order = getJourneySectionOrder('adult');
    expect(order[0]).toBe('discovered');
    expect(order[order.length - 1]).toBe('next');
  });
});
