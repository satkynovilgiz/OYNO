import { useAppStore } from '@/store/useAppStore';

import { AGE_EXPERIENCE_CONFIG, type AgeExperienceConfig } from './config';
import { experienceForAgeGroup, type AgeExperience, type AgeGroup } from './types';

/** Age group used to drive presentation before the user has made a choice
 * (e.g. mid-onboarding, or a pre-existing account that predates this
 * feature) - defaults to the least-adapted, most information-dense
 * experience rather than guessing a child down. */
const DEFAULT_AGE_GROUP: AgeGroup = '18+';

export type UseAgeExperienceResult = {
  ageGroup: AgeGroup;
  /** Whether the user has actually made this choice, vs. it being the
   * fallback default above. */
  hasChosenAgeGroup: boolean;
  experience: AgeExperience;
  config: AgeExperienceConfig;
};

/** Every screen that adapts by age reads from this hook (spec "Create a
 * centralized Age Experience system... expose it via a reusable hook") -
 * never from raw AgeGroup/age values directly. */
export function useAgeExperience(): UseAgeExperienceResult {
  const storedAgeGroup = useAppStore((state) => state.ageGroup);
  const hasChosenAgeGroup = useAppStore((state) => state.hasChosenAgeGroup);

  const ageGroup = storedAgeGroup ?? DEFAULT_AGE_GROUP;
  const experience = experienceForAgeGroup(ageGroup);

  return {
    ageGroup,
    hasChosenAgeGroup,
    experience,
    config: AGE_EXPERIENCE_CONFIG[experience],
  };
}
