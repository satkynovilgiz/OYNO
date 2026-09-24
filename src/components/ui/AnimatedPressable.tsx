import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { motion, type PressPreset } from '@/theme/motion';

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
  /** Design-system press preset (theme/motion): 'soft' for cards/media
   * (1 -> 0.985, timing, no bounce), 'strong' for buttons/chips/tabs.
   * Overrides `pressScale` and swaps the spring for a short timing curve. */
  press?: PressPreset;
};

const PRESS_EASING = Easing.out(Easing.quad);

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
  press,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: AnimatedPressableProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const isHovering = useSharedValue(false);

  const preset = press ? (press === 'soft' ? motion.pressSoft : motion.pressStrong) : null;
  const pressTo = (target: number, phase: 'in' | 'out') =>
    preset
      ? withTiming(target, { duration: phase === 'in' ? preset.inMs : preset.outMs, easing: PRESS_EASING })
      : withSpring(target, phase === 'in' ? { damping: 16, stiffness: 320 } : { damping: 12, stiffness: 220 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Reduce Motion: keep every press/hover handler (haptics, onPress, etc.)
  // fully functional, just never animate the scale value away from 1 -
  // per spec "Create a restrained OYNO motion system... Respect Reduce
  // Motion".
  return (
    <ReanimatedPressable
      style={[style, animatedStyle]}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reducedMotion) scale.value = pressTo(preset ? preset.scale : pressScale, 'in');
        if (haptic && !disabled) void Haptics.impactAsync(HAPTIC_STYLES[haptic]);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reducedMotion) scale.value = pressTo(hoverEffect && isHovering.value ? hoverScale : 1, 'out');
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        isHovering.value = true;
        if (hoverEffect && !disabled && !reducedMotion) scale.value = withSpring(hoverScale, { damping: 14, stiffness: 260 });
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        isHovering.value = false;
        if (hoverEffect && !reducedMotion) scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        onHoverOut?.(event);
      }}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
}
