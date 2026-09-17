/**
 * The user-facing choice (Section "Add an onboarding step... Use age
 * groups") - kept as a small closed set of bands, never a birth date, so
 * OYNO never stores or reasons about an exact age.
 */
export type AgeGroup = '6-9' | '10-13' | '14-17' | '18+';

export const ALL_AGE_GROUPS: AgeGroup[] = ['6-9', '10-13', '14-17', '18+'];

/**
 * The internal experience the rest of the app actually adapts to (Section
 * "Create a centralized Age Experience system... AgeExperience = child |
 * preteen | teen | adult"). Kept as its own type, separate from
 * `AgeGroup`, so a future re-slicing of the age bands (or adding a
 * "grown-up mode" override, say) only ever touches this one mapping
 * function - no screen should ever compare a raw `AgeGroup` string.
 */
export type AgeExperience = 'child' | 'preteen' | 'teen' | 'adult';

const AGE_GROUP_TO_EXPERIENCE: Record<AgeGroup, AgeExperience> = {
  '6-9': 'child',
  '10-13': 'preteen',
  '14-17': 'teen',
  '18+': 'adult',
};

export function experienceForAgeGroup(ageGroup: AgeGroup): AgeExperience {
  return AGE_GROUP_TO_EXPERIENCE[ageGroup];
}

/**
 * Content-depth levels (Section "Build age-aware content presentation" -
 * "same cultural topic... explainable at different depths"). Deliberately
 * NOT 1:1 with AgeExperience (a teen and an engaged preteen can both want
 * "standard") - screens pick a depth from `AgeExperienceConfig.learningDepth`
 * as a *default*, and content authors provide whichever depth variants
 * they actually have, falling back to `standard` when a variant is
 * missing rather than inventing one at runtime.
 */
export type ContentDepth = 'simple' | 'standard' | 'advanced';
