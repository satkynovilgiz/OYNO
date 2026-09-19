import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useReducedMotion } from './useReducedMotion';

/** Subtle scroll-linked hero motion for a detail screen's full-bleed image
 * (spec "Create a restrained OYNO motion system... Hero artwork - very
 * subtle image transition/parallax where performance allows"). The hero
 * drifts slower than the scroll and stretches slightly on overscroll -
 * driven entirely on the UI thread via Reanimated's scroll handler, no JS
 * work per frame. A no-op transform under Reduce Motion. */
export function useHeroParallax() {
  const reducedMotion = useReducedMotion();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const heroStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    return {
      transform: [
        { translateY: scrollY.value * -0.25 },
        { scale: interpolate(scrollY.value, [-120, 0], [1.2, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return { scrollHandler, heroStyle };
}
