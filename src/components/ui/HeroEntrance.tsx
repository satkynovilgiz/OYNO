import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { SCREEN_MOTION_BY_INTENSITY } from '@/services/motion/motionTokens';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';

type HeroEntranceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * A page's hero artwork settles in with a fade + a very subtle scale from
 * ~0.98 to 1 (spec "Hero image: subtle fade + scale from approximately
 * 0.98 -> 1, NO dramatic zoom") - distinct from `ScreenEntrance`'s
 * translateY treatment, which reads right for header text/controls but
 * not for a photo. Runs once per mount. No-op under Reduce Motion.
 */
export function HeroEntrance({ children, style }: HeroEntranceProps) {
  const { config } = useAgeExperience();
  const reducedMotion = useReducedMotion();
  const motion = SCREEN_MOTION_BY_INTENSITY[config.animationIntensity];

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.98);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: motion.enterDurationMs });
    scale.value = withTiming(1, { duration: motion.enterDurationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
