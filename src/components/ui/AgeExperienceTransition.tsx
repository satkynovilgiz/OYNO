import { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';

type AgeExperienceTransitionProps = {
  children: ReactNode;
  /** Pass through whatever layout style (gap, padding...) the section
   * list this wraps would otherwise have carried on its own container, so
   * inserting this wrapper never changes existing spacing. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps a screen's age-adaptive section list so switching AgeExperience
 * (spec "Create a restrained OYNO motion system... When changing age
 * mode: smoothly transition layout/content, avoid abrupt flashing")
 * crossfades in the new layout instead of jump-cutting to it. Keyed by
 * `experience` so React only remounts the subtree on a real mode change
 * (not on every render) and Reanimated's `entering` animation smooths
 * that remount on the UI thread. Skipped entirely under Reduce Motion -
 * content just appears immediately, no flash either way.
 */
export function AgeExperienceTransition({ children, style }: AgeExperienceTransitionProps) {
  const { experience } = useAgeExperience();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return <>{children}</>;

  return (
    <Animated.View key={experience} style={style} entering={FadeIn.duration(220)}>
      {children}
    </Animated.View>
  );
}
