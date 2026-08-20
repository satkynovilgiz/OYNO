import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme';

type StoneProps = {
  /** 0 = resting on the ground/in hand, 1 = at the peak of a toss. Drives the
   * pseudo-3D "closer to camera" illusion: bigger + softer/wider shadow near
   * the peak, small + tight shadow at rest. Omit for a stone that never
   * animates (it gets its own always-zero shared value, never a plain
   * object — worklets require a real Reanimated shared value). */
  liftProgress?: SharedValue<number>;
  size?: number;
  tone?: 'ground' | 'held';
};

const AnimatedView = Animated.View;

export function Stone({ liftProgress, size = 22, tone = 'ground' }: StoneProps) {
  const fallbackProgress = useSharedValue(0);
  const progress = liftProgress ?? fallbackProgress;

  const bodyStyle = useAnimatedStyle(() => {
    const lift = progress.value;
    const scale = interpolate(lift, [0, 1], [1, 1.35]);
    const translateY = interpolate(lift, [0, 1], [0, -64]);
    const rotate = interpolate(lift, [0, 1], [0, 220]);
    return {
      transform: [{ translateY }, { scale }, { rotateZ: `${rotate}deg` }],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const lift = progress.value;
    return {
      opacity: interpolate(lift, [0, 1], [0.35, 0.12]),
      transform: [{ scaleX: interpolate(lift, [0, 1], [1, 1.8]) }],
    };
  });

  const backgroundColor = tone === 'held' ? colors.primary : colors.accentBrown;

  return (
    <AnimatedView style={[styles.wrap, { width: size * 1.8 }]}>
      <AnimatedView
        style={[styles.shadow, shadowStyle, { width: size * 0.9, height: size * 0.3 }]}
      />
      <AnimatedView
        style={[
          styles.body,
          bodyStyle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor },
        ]}
      />
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 90,
  },
  shadow: {
    position: 'absolute',
    bottom: 4,
    borderRadius: 999,
    backgroundColor: '#000',
  },
  body: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
});
