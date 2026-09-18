import { MOTION_BY_INTENSITY } from './motionTokens';

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
