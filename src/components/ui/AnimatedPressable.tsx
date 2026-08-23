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
  /** Adds a subtle scale-up on mouse hover (web only - onHoverIn/Out never
   * fire on native touch, so this is a no-op there). Use for cards/tiles
   * that want pointer feedback without a heavy press animation. */
  hoverEffect?: boolean;
  hoverScale?: number;
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
  hoverEffect = false,
  hoverScale = 1.02,
  haptic = false,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const isHovering = useSharedValue(false);

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
        scale.value = withSpring(hoverEffect && isHovering.value ? hoverScale : 1, { damping: 12, stiffness: 220 });
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        isHovering.value = true;
        if (hoverEffect && !disabled) scale.value = withSpring(hoverScale, { damping: 14, stiffness: 260 });
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        isHovering.value = false;
        if (hoverEffect) scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        onHoverOut?.(event);
      }}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
}
