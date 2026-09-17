import { AGE_EXPERIENCE_CONFIG } from './config';
import { ALL_AGE_GROUPS, experienceForAgeGroup, type AgeExperience } from './types';

describe('experienceForAgeGroup', () => {
  it('maps every age group to its experience exactly once', () => {
    const mapped = ALL_AGE_GROUPS.map(experienceForAgeGroup);
    expect(mapped).toEqual(['child', 'preteen', 'teen', 'adult']);
  });
});

describe('AGE_EXPERIENCE_CONFIG', () => {
  const experiences: AgeExperience[] = ['child', 'preteen', 'teen', 'adult'];

  it('defines a config for all four experiences', () => {
    expect(Object.keys(AGE_EXPERIENCE_CONFIG).sort()).toEqual([...experiences].sort());
  });

  it.each(experiences)('%s config has every required field populated', (experience) => {
    const config = AGE_EXPERIENCE_CONFIG[experience];
    expect(config.contentDensity).toBeTruthy();
    expect(config.cardScale).toBeTruthy();
    expect(config.artworkProminence).toBeTruthy();
    expect(config.textComplexity).toBeTruthy();
    expect(config.characterProminence).toBeTruthy();
    expect(config.animationIntensity).toBeTruthy();
    expect(config.learningDepth).toBeTruthy();
    expect(config.challengeDifficulty).toBeTruthy();
    expect(config.navigationDensity).toBeTruthy();
  });

  it('scales content density and card scale from child up to adult', () => {
    expect(AGE_EXPERIENCE_CONFIG.child.contentDensity).toBe('low');
    expect(AGE_EXPERIENCE_CONFIG.adult.contentDensity).toBe('high');
    expect(AGE_EXPERIENCE_CONFIG.child.cardScale).toBe('large');
    expect(AGE_EXPERIENCE_CONFIG.adult.cardScale).toBe('compact');
  });

  it('reduces character prominence from child (primary) to adult (subtle)', () => {
    expect(AGE_EXPERIENCE_CONFIG.child.characterProminence).toBe('primary');
    expect(AGE_EXPERIENCE_CONFIG.preteen.characterProminence).toBe('frequent');
    expect(AGE_EXPERIENCE_CONFIG.teen.characterProminence).toBe('occasional');
    expect(AGE_EXPERIENCE_CONFIG.adult.characterProminence).toBe('subtle');
  });

  it('never gives child or preteen the advanced learning depth', () => {
    expect(AGE_EXPERIENCE_CONFIG.child.learningDepth).not.toBe('advanced');
    expect(AGE_EXPERIENCE_CONFIG.preteen.learningDepth).not.toBe('advanced');
  });
});
