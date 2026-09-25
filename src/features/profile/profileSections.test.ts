import { ALL_PROFILE_SECTIONS, getProfileSectionOrder } from './profileSections';

describe('getProfileSectionOrder', () => {
  it.each(['child', 'preteen', 'teen', 'adult'] as const)(
    '%s renders every section exactly once (same screen, different order)',
    (experience) => {
      const order = getProfileSectionOrder(experience);
      expect([...order].sort()).toEqual([...ALL_PROFILE_SECTIONS].sort());
    },
  );

  it('puts achievements first for child (avatar + achievements prominent)', () => {
    expect(getProfileSectionOrder('child')[0]).toBe('achievements');
  });

  it('leads with collection for preteen (collectibles + progress)', () => {
    expect(getProfileSectionOrder('preteen')[0]).toBe('collection');
    expect(getProfileSectionOrder('preteen')[1]).toBe('journey');
  });

  it('leads with journey for adult and pushes achievements to the end (quieter gamification)', () => {
    const order = getProfileSectionOrder('adult');
    expect(order[0]).toBe('journey');
    expect(order[order.length - 1]).toBe('achievements');
  });
});
