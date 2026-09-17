import { ALL_HOME_SECTIONS, getHomeSectionOrder } from './homeSections';

describe('getHomeSectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)(
    '%s renders every section exactly once (same screen, different order)',
    (experience) => {
      const order = getHomeSectionOrder(experience);
      expect([...order].sort()).toEqual([...ALL_HOME_SECTIONS].sort());
    },
  );

  it('puts games front and center for child (big Continue Playing)', () => {
    expect(getHomeSectionOrder('child').indexOf('games')).toBeLessThan(getHomeSectionOrder('child').indexOf('culture'));
  });

  it('leads with culture for adult and pushes games toward the end', () => {
    const order = getHomeSectionOrder('adult');
    expect(order[0]).toBe('culture');
    expect(order.indexOf('games')).toBeGreaterThan(order.indexOf('dailyProgress'));
  });
});
