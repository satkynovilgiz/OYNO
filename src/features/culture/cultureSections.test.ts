import { ALL_CULTURE_SECTIONS, getCultureSectionOrder } from './cultureSections';

describe('getCultureSectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)(
    '%s renders every section exactly once (same screen, different order)',
    (experience) => {
      const order = getCultureSectionOrder(experience);
      expect([...order].sort()).toEqual([...ALL_CULTURE_SECTIONS].sort());
    },
  );

  it('leads with hands-on creators for child', () => {
    const order = getCultureSectionOrder('child');
    expect(order.indexOf('interactive')).toBeLessThan(order.indexOf('newMaterials'));
    expect(order.indexOf('bozUy')).toBeLessThan(order.indexOf('learn'));
  });

  it('leads with curated collections for adult and pushes creator tools last', () => {
    const order = getCultureSectionOrder('adult');
    expect(order[0]).toBe('collections');
    expect(order.indexOf('interactive')).toBeGreaterThan(order.indexOf('categories'));
    expect(order.indexOf('bozUy')).toBeGreaterThan(order.indexOf('categories'));
  });
});
