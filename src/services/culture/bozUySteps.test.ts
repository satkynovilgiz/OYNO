import { BOZ_UY_STEPS, clampStepIndex, isLastStep } from './bozUySteps';

describe('BOZ_UY_STEPS', () => {
  it('has the 4 verified steps in construction order', () => {
    expect(BOZ_UY_STEPS.map((step) => step.id)).toEqual(['kerege', 'uuk', 'tunduk', 'bosogo']);
  });

  it('gives every step a name/description/tip i18n key', () => {
    for (const step of BOZ_UY_STEPS) {
      expect(step.nameKey).toContain(step.id);
      expect(step.descriptionKey).toContain(step.id);
      expect(step.tipKey).toContain(step.id);
    }
  });
});

describe('clampStepIndex', () => {
  it('clamps below the first step', () => {
    expect(clampStepIndex(-5)).toBe(0);
  });

  it('clamps beyond the last step', () => {
    expect(clampStepIndex(99)).toBe(BOZ_UY_STEPS.length - 1);
  });

  it('leaves an in-range index unchanged', () => {
    expect(clampStepIndex(2)).toBe(2);
  });
});

describe('isLastStep', () => {
  it('is false before the last step', () => {
    expect(isLastStep(0)).toBe(false);
    expect(isLastStep(BOZ_UY_STEPS.length - 2)).toBe(false);
  });

  it('is true on the last step', () => {
    expect(isLastStep(BOZ_UY_STEPS.length - 1)).toBe(true);
  });
});
