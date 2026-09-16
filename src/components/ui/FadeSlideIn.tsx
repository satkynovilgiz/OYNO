import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

type FadeSlideInProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Position within its own list/grid/section (not a global index) - used
   * to stagger a cascading reveal instead of every item popping in at
   * once. Capped internally so a long list doesn't keep animating in for
   * seconds after it renders. */
  index?: number;
};

/** Shared "subtle entrance animation" primitive (Section "Add subtle...
 * entrance animations using the project's existing animation system") - a
 * short fade + gentle rise, staggered by `index`, built on the same
 * Reanimated idiom already used by `GameIntroCard`/`StartCountdown`/
 * `games/GameCard`. One place to tune timing/easing for every card grid
 * or list across the app instead of each screen re-implementing its own
 * `useSharedValue`/`useAnimatedStyle` pair. */
export function FadeSlideIn({ children, style, index = 0 }: FadeSlideInProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    const delay = Math.min(index, 8) * 55;
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 260 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
