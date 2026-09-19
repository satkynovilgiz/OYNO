import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { MOTION_BY_INTENSITY } from '@/services/motion/motionTokens';
import { useReducedMotion } from '@/services/motion/useReducedMotion';

type FadeSlideInProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Position within its own list/grid/section (not a global index) - used
   * to stagger a cascading reveal instead of every item popping in at
   * once. Capped internally so a long list doesn't keep animating in for
   * seconds after it renders. */
  index?: number;
  /** Delay in ms between consecutive `index` steps. Defaults to 55 (the
   * original per-card-grid tuning). Screen-level section orchestration
   * passes a tighter ~40 (spec "around 25-50ms difference between nearby
   * elements") since sections are fewer and larger than grid cards. */
  staggerMs?: number;
};

/** Shared "subtle entrance animation" primitive (spec "Create a
 * restrained OYNO motion system... Screen entrance: subtle fade/
 * translate, fast and natural") - a short fade + gentle rise, staggered
 * by `index`. Distance/duration come from `AgeExperienceConfig.
 * animationIntensity` (child reads slightly livelier, adult calmer) via
 * `motionTokens.ts`, and the whole animation is skipped (content appears
 * instantly) when the OS "Reduce Motion" setting is on. One place to tune
 * timing/easing for every card grid or list across the app instead of
 * each screen re-implementing its own `useSharedValue`/`useAnimatedStyle`
 * pair. */
export function FadeSlideIn({ children, style, index = 0, staggerMs = 55 }: FadeSlideInProps) {
  const { config } = useAgeExperience();
  const reducedMotion = useReducedMotion();
  const motion = MOTION_BY_INTENSITY[config.animationIntensity];

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : motion.enterDistance);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const delay = Math.min(index, 8) * staggerMs;
    opacity.value = withDelay(delay, withTiming(1, { duration: motion.enterDurationMs }));
    translateY.value = withDelay(delay, withTiming(0, { duration: motion.enterDurationMs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
