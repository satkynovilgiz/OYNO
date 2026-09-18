import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  fillColor?: string;
  children?: ReactNode;
};

/** Circular counterpart to ProgressBar - a ring with optional centered
 * content (an icon, a number). Used for compact stat cards. Animates its
 * sweep toward `progress` on mount/change the same way ProgressBar does
 * (spec "animate XP/progress rings/bars when they enter, do not replay
 * excessively"), jumping straight to the target with Reduce Motion on. */
export function ProgressRing({
  progress,
  size = 56,
  strokeWidth = 4,
  trackColor = colors.surfaceAlt,
  fillColor = colors.primary,
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const reducedMotion = useReducedMotion();
  const animatedProgress = useSharedValue(reducedMotion ? clamped : 0);

  useEffect(() => {
    animatedProgress.value = reducedMotion ? clamped : withTiming(clamped, { duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
