import { findNextIncompleteStep, resolveStepRoute, type QuestStep } from './questSteps';

const steps: QuestStep[] = [
  { id: 's1', questId: 'lost-shyrdak', stepOrder: 1, stepType: 'VISIT_LOCATION', targetId: 'ysyk-kol' },
  { id: 's2', questId: 'lost-shyrdak', stepOrder: 2, stepType: 'DISCOVER_ITEM', targetId: 'boz-uy' },
  { id: 's3', questId: 'lost-shyrdak', stepOrder: 3, stepType: 'OPEN_CULTURE_ITEM', targetId: 'boz-uy-overview' },
];

describe('findNextIncompleteStep', () => {
  it('returns the first step in order when none are completed', () => {
    expect(findNextIncompleteStep(steps, [])).toEqual(steps[0]);
  });

  it('skips completed steps regardless of input order', () => {
    const shuffled = [steps[2], steps[0], steps[1]];
    expect(findNextIncompleteStep(shuffled, ['s1'])).toEqual(steps[1]);
  });

  it('returns null when every step is completed', () => {
    expect(findNextIncompleteStep(steps, ['s1', 's2', 's3'])).toBeNull();
  });
});

describe('resolveStepRoute', () => {
  it('routes VISIT_LOCATION to the region detail page', () => {
    expect(resolveStepRoute(steps[0])).toBe('/explore/ysyk-kol');
  });

  it('routes DISCOVER_ITEM to the discovery region when it has one', () => {
    expect(resolveStepRoute(steps[1], 'ysyk-kol')).toBe('/explore/ysyk-kol');
  });

  it('routes DISCOVER_ITEM to /explore when the discovery has no region', () => {
    expect(resolveStepRoute(steps[1], null)).toBe('/explore');
  });

  it('routes OPEN_CULTURE_ITEM to the culture item detail page', () => {
    expect(resolveStepRoute(steps[2])).toBe('/culture/item/boz-uy-overview');
  });
});
