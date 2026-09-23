import { collections } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { INTERACTIVE_EXPERIENCES } from '@/features/culture/interactiveExperiences';
import { natureSiteCoordinates } from '@/features/explore/data';
import { mockGamesList } from '@/features/games/mockData';

import { computeTrailProgress, validateTrail, type TrailCatalog, type TrailSignals } from './trailProgress';
import { trails, type Trail } from './trailsData';

// Culture items used in trails are all photo-backed rows (verified live);
// materials come from the four culture_materials rows.
const catalog: TrailCatalog = {
  destinationIds: Object.keys(natureSiteCoordinates),
  cultureItemIds: Object.keys(cultureItemImages),
  cultureMaterialIds: ['komuz-discovery', 'kalpak-history', 'boorsok-cooking', 'kyz-kuumai-game'],
  interactiveIds: INTERACTIVE_EXPERIENCES.map((experience) => experience.id),
  gameIds: mockGamesList.filter((game) => !!game.route).map((game) => game.id),
  collectionIds: collections.map((collection) => collection.id),
};

const none: TrailSignals = {
  completionFlags: { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false },
  gameStats: {},
  visitedRegionIds: [],
};

describe('trail definitions', () => {
  it.each(trails.map((trail) => [trail.id, trail] as const))('%s references only real content, no duplicates', (_id, trail) => {
    expect(validateTrail(trail, catalog)).toEqual([]);
  });

  it('every trail has at least two trackable steps', () => {
    for (const trail of trails) expect(computeTrailProgress(trail, none).total).toBeGreaterThanOrEqual(2);
  });

  it('flags duplicate and missing steps', () => {
    const bad: Trail = { ...trails[0], steps: [{ type: 'game', id: 'kok-boru' }, { type: 'game', id: 'kok-boru' }, { type: 'destination', id: 'atlantis' }] };
    expect(validateTrail(bad, catalog)).toEqual(['duplicate step game:kok-boru', 'missing destination:atlantis']);
  });
});

describe('computeTrailProgress', () => {
  const horse = trails.find((trail) => trail.id === 'horse-culture')!;

  it('treats culture items as informational and counts only tracked steps', () => {
    const progress = computeTrailProgress(horse, none);
    expect(progress.total).toBe(2);
    expect(progress.steps.filter((entry) => entry.state === 'info')).toHaveLength(4);
    expect(progress).toMatchObject({ completed: 0, status: 'unstarted', nextStep: { type: 'game', id: 'kok-boru' } });
  });

  it('moves the next step forward and completes on real signals only', () => {
    const one = computeTrailProgress(horse, { ...none, gameStats: { kok_boru: { played: 1, won: 0 } } });
    expect(one).toMatchObject({ completed: 1, status: 'inProgress', nextStep: { type: 'game', id: 'kyz-kuumay' } });
    const done = computeTrailProgress(horse, { ...none, gameStats: { kok_boru: { played: 1, won: 0 }, kyz_kuumai: { played: 2, won: 1 } } });
    expect(done).toMatchObject({ completed: 2, total: 2, status: 'completed', nextStep: null });
  });

  it('never counts games that do not record plays', () => {
    const trail: Trail = { ...horse, steps: [{ type: 'game', id: 'besh-tash' }, { type: 'destination', id: 'son-kol' }] };
    const progress = computeTrailProgress(trail, { ...none, gameStats: { 'besh-tash': { played: 5, won: 0 } } });
    expect(progress.steps[0].state).toBe('info');
    expect(progress.total).toBe(1);
  });

  it('uses visits, interactive flags and collection completion', () => {
    const nomad = trails.find((trail) => trail.id === 'nomad-life')!;
    const signals: TrailSignals = {
      completionFlags: { ...none.completionFlags, bozUyVisited: true },
      gameStats: { chuko: { played: 1, won: 0 }, kok_boru: { played: 1, won: 0 }, kyz_kuumai: { played: 1, won: 0 } },
      visitedRegionIds: ['suusamyr'],
    };
    expect(computeTrailProgress(nomad, signals)).toMatchObject({ completed: 4, total: 4, status: 'completed' });
  });

  it('reports an all-informational trail as untracked', () => {
    const infoOnly: Trail = { ...horse, steps: [{ type: 'culture_item', id: 'horse-overview' }] };
    expect(computeTrailProgress(infoOnly, none)).toMatchObject({ total: 0, status: 'untracked', nextStep: null });
  });
});
