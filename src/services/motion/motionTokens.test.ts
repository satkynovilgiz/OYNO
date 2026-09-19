import { MOTION_BY_INTENSITY, SCREEN_MOTION_BY_INTENSITY } from './motionTokens';

describe('MOTION_BY_INTENSITY', () => {
  it('defines all three intensities', () => {
    expect(Object.keys(MOTION_BY_INTENSITY).sort()).toEqual(['calm', 'moderate', 'playful']);
  });

  it('scales press scale and entrance distance from playful (child) down to calm (adult)', () => {
    expect(MOTION_BY_INTENSITY.playful.pressScale).toBeLessThan(MOTION_BY_INTENSITY.moderate.pressScale);
    expect(MOTION_BY_INTENSITY.moderate.pressScale).toBeLessThan(MOTION_BY_INTENSITY.calm.pressScale);
    expect(MOTION_BY_INTENSITY.playful.enterDistance).toBeGreaterThan(MOTION_BY_INTENSITY.calm.enterDistance);
  });
});

describe('SCREEN_MOTION_BY_INTENSITY', () => {
  it('defines all three intensities', () => {
    expect(Object.keys(SCREEN_MOTION_BY_INTENSITY).sort()).toEqual(['calm', 'moderate', 'playful']);
  });

  it('stays within the restrained 250-450ms screen-entrance window for every tier', () => {
    for (const tier of Object.values(SCREEN_MOTION_BY_INTENSITY)) {
      expect(tier.enterDurationMs).toBeGreaterThanOrEqual(250);
      expect(tier.enterDurationMs).toBeLessThanOrEqual(450);
    }
  });

  it('is slower than the equivalent per-card MOTION_BY_INTENSITY tier - a page arrival is a single steadier moment, not a repeated card pop', () => {
    expect(SCREEN_MOTION_BY_INTENSITY.playful.enterDurationMs).toBeGreaterThan(MOTION_BY_INTENSITY.playful.enterDurationMs);
    expect(SCREEN_MOTION_BY_INTENSITY.moderate.enterDurationMs).toBeGreaterThan(MOTION_BY_INTENSITY.moderate.enterDurationMs);
    expect(SCREEN_MOTION_BY_INTENSITY.calm.enterDurationMs).toBeGreaterThan(MOTION_BY_INTENSITY.calm.enterDurationMs);
  });
});
