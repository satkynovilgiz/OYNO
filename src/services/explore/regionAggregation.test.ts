import { computeRegionCompletions } from './regionAggregation';
import type { QuestStep } from './questSteps';

const regionIds = ['ysyk-kol', 'osh'];

const discoveries = [
  { id: 'ysyk-kol-shore', regionId: 'ysyk-kol' },
  { id: 'boz-uy', regionId: null },
];

const questSteps: QuestStep[] = [
  { id: 's1', questId: 'lost-shyrdak', stepOrder: 1, stepType: 'VISIT_LOCATION', targetId: 'ysyk-kol' },
  { id: 's2', questId: 'lost-shyrdak', stepOrder: 2, stepType: 'DISCOVER_ITEM', targetId: 'boz-uy' },
];

describe('computeRegionCompletions', () => {
  it('gives a region with no linked discoveries/steps a 0/0 (locked-free) input', () => {
    const result = computeRegionCompletions({
      regionIds,
      visitedRegionIds: [],
      discoveries,
      discoveredIds: [],
      questSteps,
      completedStepIds: [],
    });
    expect(result.osh).toEqual({ percent: 0, state: 'available' });
  });

  it('counts a region-tied discovery and a VISIT_LOCATION step targeting the region', () => {
    const result = computeRegionCompletions({
      regionIds,
      visitedRegionIds: ['ysyk-kol'],
      discoveries,
      discoveredIds: [],
      questSteps,
      completedStepIds: [],
    });
    // visited(1) + discoveries(0/1) + questSteps(0/1) => started
    expect(result['ysyk-kol'].state).toBe('started');
  });

  it('resolves a DISCOVER_ITEM step to its discovery region, not the target region only', () => {
    const withDiscoverRegion = [
      { id: 'ysyk-kol-shore', regionId: 'ysyk-kol' },
      { id: 'boz-uy', regionId: 'osh' },
    ];
    const result = computeRegionCompletions({
      regionIds,
      visitedRegionIds: ['osh'],
      discoveries: withDiscoverRegion,
      discoveredIds: ['boz-uy'],
      questSteps,
      completedStepIds: ['s2'],
    });
    // osh: visited + 1/1 discovery found + 1/1 quest step done => completed
    expect(result.osh).toEqual({ percent: 100, state: 'completed' });
  });

  it('reaches completed once every linked discovery and quest step for the region is done', () => {
    const result = computeRegionCompletions({
      regionIds,
      visitedRegionIds: ['ysyk-kol'],
      discoveries,
      discoveredIds: ['ysyk-kol-shore'],
      questSteps,
      completedStepIds: ['s1'],
    });
    expect(result['ysyk-kol']).toEqual({ percent: 100, state: 'completed' });
  });
});
