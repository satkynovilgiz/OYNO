import { computeCollectionProgress } from '@/features/collections/collectionProgress';
import { collections } from '@/features/collections/collectionsData';
import { buildPassport } from '@/features/journey/passport';
import { computeTrailProgress, type TrailSignals } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { routeForTrailStep } from '@/features/trails/trailDisplay';
import type { ExploreRegionRow } from '@/services/content/types';

import { buildHomeJourneyRecommendation, buildRecentlyExplored, type HomeRecommendationInput } from './homeRecommendation';

const regions = ['son-kol', 'suusamyr', 'alay'].map((id) => ({ id, kind: 'nature', name_kg: id, name_ru: id, name_en: id }) as ExploreRegionRow);

const none: TrailSignals = {
  completionFlags: { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false },
  gameStats: {},
  visitedRegionIds: [],
};

function input(signals: TrailSignals, overrides: Partial<HomeRecommendationInput> = {}): HomeRecommendationInput {
  return {
    trails: trails.map((trail) => {
      const progress = computeTrailProgress(trail, signals);
      return { trail, progress, nextRoute: progress.nextStep ? routeForTrailStep(progress.nextStep) : null };
    }),
    quest: null,
    daily: { itemId: 'boz-uy-kiyiz-jabuu', isCompleted: false },
    collections: collections.map((collection) => ({ collection, progress: computeCollectionProgress(collection, signals) })),
    passport: buildPassport(regions, signals.visitedRegionIds, {}, () => undefined, 'en'),
    playedGames: [],
    untriedInteractive: [{ id: 'oymo', route: '/culture/oymo/create' }],
    isAvailable: () => true,
    ...overrides,
  };
}

// Kok Boru played -> Horse Culture trail in progress (1/2) AND the Horse
// collection in progress (1/2).
const horseStarted: TrailSignals = { ...none, gameStats: { kok_boru: { played: 2, won: 0 } } };

describe('buildHomeJourneyRecommendation priority', () => {
  it('an active trail beats Daily', () => {
    const rec = buildHomeJourneyRecommendation(input(horseStarted));
    expect(rec).toMatchObject({ mode: 'continue', kind: 'trail', contentId: 'horse-culture', route: '/games/kyz-kuumai', progress: { completed: 1, total: 2 } });
  });

  it('an active quest comes right after trails', () => {
    const rec = buildHomeJourneyRecommendation(input(none, { quest: { id: 'lost-shyrdak', current: 2, total: 5, completed: false, nextRoute: '/explore/naryn' } }));
    expect(rec).toMatchObject({ kind: 'quest', route: '/explore/naryn', progress: { completed: 2, total: 5 } });
  });

  it('Daily beats an in-progress collection', () => {
    const signals = { ...none, completionFlags: { ...none.completionFlags, oymoCreated: true } }; // Ornament collection 1/2
    const rec = buildHomeJourneyRecommendation(input(signals));
    expect(rec).toMatchObject({ mode: 'today', kind: 'daily', route: '/daily' });
  });

  it('a collection beats the Passport once Daily is done', () => {
    const signals = { ...none, completionFlags: { ...none.completionFlags, oymoCreated: true }, visitedRegionIds: ['son-kol'] };
    // (trails excluded here: visiting Son-Köl also starts the Nature trail, which would win at rule 1)
    const rec = buildHomeJourneyRecommendation(input(signals, { daily: { itemId: 'x', isCompleted: true }, trails: [] }));
    expect(rec).toMatchObject({ kind: 'collection', contentId: 'kyrgyz-ornament', progress: { completed: 1, total: 2 } });
  });

  it('suggests the first undiscovered place when the Passport is started', () => {
    const signals = { ...none, visitedRegionIds: ['son-kol'] };
    const rec = buildHomeJourneyRecommendation(input(signals, { daily: null }));
    // nature-of-kyrgyzstan trail is now started too (son-kol visited) -> it wins
    expect(rec.kind).toBe('trail');
    const noTrails = buildHomeJourneyRecommendation(input(signals, { daily: null, trails: [] }));
    expect(noTrails).toMatchObject({ kind: 'passport', targetId: 'suusamyr', route: '/explore/suusamyr', progress: { completed: 1, total: 3 } });
  });

  it('skips completed content and missing screens', () => {
    const done = { ...none, gameStats: { kok_boru: { played: 1, won: 0 }, kyz_kuumai: { played: 1, won: 0 } } };
    const rec = buildHomeJourneyRecommendation(input(done, { daily: { itemId: 'x', isCompleted: true } }));
    expect(rec.contentId).not.toBe('horse-culture'); // trail + collection complete
    const brokenQuest = buildHomeJourneyRecommendation(input(none, { daily: null, quest: { id: 'q', current: 1, total: 5, completed: false, nextRoute: null } }));
    expect(brokenQuest.kind).not.toBe('quest');
  });

  it('only recommends games the user really played, most played first', () => {
    const rec = buildHomeJourneyRecommendation(
      input(none, {
        daily: null,
        trails: [],
        collections: [],
        playedGames: [
          { gameId: 'chuko', route: '/games/chuko', played: 1 },
          { gameId: 'ordo', route: '/games/ordo', played: 4 },
        ],
      }),
    );
    expect(rec).toMatchObject({ mode: 'continue', kind: 'game', contentId: 'ordo', progress: null });
  });

  it('offline: skips content that cannot load and picks one that can', () => {
    const available = new Set(['/daily']);
    const rec = buildHomeJourneyRecommendation(input(horseStarted, { isAvailable: (route) => available.has(route) || route.startsWith('/games/') }));
    // the trail's next step (a local game) is fine offline
    expect(rec.kind).toBe('trail');
    const onlyDaily = buildHomeJourneyRecommendation(input(none, { isAvailable: (route) => route === '/daily' }));
    expect(onlyDaily.kind).toBe('daily');
    const nothing = buildHomeJourneyRecommendation(input(none, { daily: null, isAvailable: () => false }));
    expect(nothing.mode).toBe('complete');
  });

  it('with no active progress returns a valid Explore-next result', () => {
    const rec = buildHomeJourneyRecommendation(input(none, { daily: null }));
    expect(rec).toMatchObject({ mode: 'exploreNext', kind: 'passport', route: '/explore/son-kol' });
  });

  it('reports Journey complete only when everything is genuinely done', () => {
    const all: TrailSignals = {
      completionFlags: { bozUyVisited: true, oymoCreated: true, shyrdakCreated: true, komuzLessonCompleted: true },
      gameStats: { kok_boru: { played: 1, won: 0 }, kyz_kuumai: { played: 1, won: 0 }, chuko: { played: 1, won: 0 } },
      visitedRegionIds: ['son-kol', 'suusamyr', 'alay', 'ala-too', 'sary-chelek', 'arslanbob'],
    };
    const rec = buildHomeJourneyRecommendation(
      input(all, { daily: { itemId: 'x', isCompleted: true }, untriedInteractive: [], playedGames: [{ gameId: 'chuko', route: '/games/chuko', played: 1 }] }),
    );
    expect(rec.kind).toBe('game'); // play-again still offered before 'complete'
    const noGames = buildHomeJourneyRecommendation(input(all, { daily: null, untriedInteractive: [], playedGames: [] }));
    expect(noGames).toMatchObject({ mode: 'complete', route: '/journey' });
  });
});

describe('buildRecentlyExplored', () => {
  it('lists real dated activity newest first, max 3, no duplicates', () => {
    const recent = buildRecentlyExplored(
      { 'son-kol': '2026-09-20T08:00:00Z', alay: '2026-09-22T09:00:00Z', osh: '2026-09-10T09:00:00Z' },
      { '2026-09-21': 'horse-eer', '2026-09-22': 'horse-eer' },
    );
    expect(recent.map((entry) => `${entry.kind}:${entry.id}`)).toEqual(['daily:horse-eer', 'place:alay', 'place:son-kol']);
  });

  it('is empty when there is no real history', () => {
    expect(buildRecentlyExplored({}, {})).toEqual([]);
  });
});
