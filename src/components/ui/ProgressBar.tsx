import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors } from '@/theme';

type ProgressBarProps = {
  progress: number; // 0..1
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
};

/** Animates its fill toward `progress` (spec "Create a restrained OYNO
 * motion system... Progress: animate XP/progress rings/bars when they
 * enter, do not replay excessively") - starts at 0 and eases to the
 * initial value once on mount, then eases smoothly between values on
 * every later change (e.g. claiming a reward) rather than re-animating
 * from 0 each time. Jumps straight to the target with Reduce Motion on. */
export function ProgressBar({
  progress,
  height = 8,
  trackColor = colors.surfaceAlt,
  fillColor = colors.primary,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const reducedMotion = useReducedMotion();
  const animatedProgress = useSharedValue(reducedMotion ? clamped : 0);

  useEffect(() => {
    animatedProgress.value = reducedMotion ? clamped : withTiming(clamped, { duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          { borderRadius: height / 2, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
