import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const WIDTH = 46;
const HEIGHT = 28;
const KNOB_SIZE = 22;
const PADDING = 3;

export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false }: ToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 150 });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? colors.primary : colors.surfaceBorder,
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (WIDTH - KNOB_SIZE - PADDING * 2) }],
  }));

  return (
    <AnimatedPressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.pressable, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: WIDTH,
    height: HEIGHT,
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PADDING,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: colors.surface,
  },
});
