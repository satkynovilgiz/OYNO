import { ALL_EXPLORE_SECTIONS, getExploreSectionOrder, pickFeaturedDestination } from './exploreSections';

describe('getExploreSectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)('%s renders every section exactly once (same screen, different order)', (experience) => {
    const order = getExploreSectionOrder(experience);
    expect([...order].sort()).toEqual([...ALL_EXPLORE_SECTIONS].sort());
  });

  it.each(['child', 'preteen', 'teen', 'adult'] as const)('%s opens with the featured destination', (experience) => {
    expect(getExploreSectionOrder(experience)[0]).toBe('featured');
  });

  it('child gets the guided quest right after featured; adult keeps the quest last', () => {
    expect(getExploreSectionOrder('child')[1]).toBe('quest');
    expect(getExploreSectionOrder('adult').at(-1)).toBe('quest');
  });

  it('preteen puts Passport progress before the destination rail', () => {
    const order = getExploreSectionOrder('preteen');
    expect(order.indexOf('passport')).toBeLessThan(order.indexOf('nature'));
  });
});

describe('pickFeaturedDestination', () => {
  const sites = ['son-kol', 'suusamyr', 'alay'];
  it('is deterministic per day and cycles through every real destination', () => {
    expect(pickFeaturedDestination(sites, 10)).toBe(pickFeaturedDestination(sites, 10));
    expect(new Set([0, 1, 2].map((day) => pickFeaturedDestination(sites, day)))).toEqual(new Set(sites));
  });
  it('handles an empty list and negative day numbers', () => {
    expect(pickFeaturedDestination([], 3)).toBeNull();
    expect(sites).toContain(pickFeaturedDestination(sites, -4));
  });
});
