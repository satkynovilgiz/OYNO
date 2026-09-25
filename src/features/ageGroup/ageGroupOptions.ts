import { Baby, Flame, GraduationCap, Rocket, type LucideIcon } from 'lucide-react-native';

import { ALL_AGE_GROUPS, type AgeGroup } from '@/services/ageExperience/types';

export type AgeGroupOption = {
  id: AgeGroup;
  icon: LucideIcon;
  labelKey: string;
  /** One neutral line on how OYNO adapts for this band - describes the
   * app, never the person. */
  hintKey: string;
};

/** Shared list consumed by both the onboarding step and the later Settings
 * "Experience" screen (spec "Add Age Experience controls to Settings") so
 * the two pickers never drift out of sync with each other. */
const ICONS: Record<AgeGroup, LucideIcon> = {
  '6-9': Baby,
  '10-13': Rocket,
  '14-17': Flame,
  '18+': GraduationCap,
};

export const AGE_GROUP_OPTIONS: AgeGroupOption[] = ALL_AGE_GROUPS.map((id) => ({
  id,
  icon: ICONS[id],
  labelKey: `ageGroup.options.${id}`,
  hintKey: `onboarding.v2.ageHints.${id}`,
}));
