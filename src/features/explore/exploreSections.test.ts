import { ALL_EXPLORE_SECTIONS, getExploreSectionOrder } from './exploreSections';

describe('getExploreSectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)(
    '%s renders every section exactly once (same screen, different order)',
    (experience) => {
      const order = getExploreSectionOrder(experience);
      expect([...order].sort()).toEqual([...ALL_EXPLORE_SECTIONS].sort());
    },
  );

  it('leads with the guided quest for child', () => {
    expect(getExploreSectionOrder('child')[0]).toBe('quest');
  });

  it('leads with curated nature sites for adult and pushes the quest last', () => {
    const order = getExploreSectionOrder('adult');
    expect(order[0]).toBe('natureSites');
    expect(order[order.length - 1]).toBe('quest');
  });
});
