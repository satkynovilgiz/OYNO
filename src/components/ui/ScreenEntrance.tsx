import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { SCREEN_MOTION_BY_INTENSITY } from '@/services/motion/motionTokens';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';

type ScreenEntranceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * A page's own header arrives with a single, deliberate fade + small
 * upward settle instead of popping in with everything else (spec "Create
 * a polished entrance animation system... Main header/hero: fade in,
 * very small upward movement, smooth easing"). Runs once per mount, which
 * is exactly once per tab press here - Home/Games/Explore/Culture/Profile
 * are plain Stack screens, not a persistent tab navigator, so switching
 * tabs already remounts the destination fresh. No-op under Reduce Motion.
 */
export function ScreenEntrance({ children, style }: ScreenEntranceProps) {
  const { config } = useAgeExperience();
  const reducedMotion = useReducedMotion();
  const motion = SCREEN_MOTION_BY_INTENSITY[config.animationIntensity];

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : motion.enterDistance);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: motion.enterDurationMs });
    translateY.value = withTiming(0, { duration: motion.enterDurationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
