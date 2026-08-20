import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type CatchRingProps = {
  /** 0 (just started) -> 1 (window closed, too late). */
  progress: SharedValue<number>;
  /** Fraction of the total window, at the end, that counts as a good catch (e.g. 0.25 = last quarter). */
  sweetSpotFraction?: number;
  size?: number;
};

export function CatchRing({ progress, sweetSpotFraction = 0.28, size = 96 }: CatchRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * progress.value,
    stroke: progress.value >= 1 - sweetSpotFraction ? colors.accentGold : colors.primary,
  }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.surfaceAlt}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeLinecap="round"
        animatedProps={animatedProps}
        rotation={-90}
        originX={size / 2}
        originY={size / 2}
      />
    </Svg>
  );
}
