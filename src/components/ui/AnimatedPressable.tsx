import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

const HAPTIC_STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
} as const;

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  /** Fires expo-haptics on press-in. Omit (or `false`) for non-button
   * tappables (cards, tiles) that shouldn't buzz on every tap - only actual
   * buttons should set this. */
  haptic?: keyof typeof HAPTIC_STYLES | false;
};

/**
 * Shared press/raise interaction primitive. Every tappable element in the
 * design system (icon buttons, cards with an onPress, tiles) should be built
 * on top of this instead of a bare Pressable/TouchableOpacity.
 */
export function AnimatedPressable({
  children,
  style,
  pressScale = 0.94,
  haptic = false,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      style={[style, animatedStyle]}
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withSpring(pressScale, { damping: 16, stiffness: 320 });
        if (haptic && !disabled) void Haptics.impactAsync(HAPTIC_STYLES[haptic]);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        onPressOut?.(event);
      }}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
}
