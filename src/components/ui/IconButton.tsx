import { type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, shadows } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type Variant = 'surface' | 'primary';
type Shape = 'circle' | 'roundedSquare';

type IconButtonProps = {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  variant?: Variant;
  shape?: Shape;
  showBadge?: boolean;
  disabled?: boolean;
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 44,
  iconSize,
  variant = 'surface',
  shape = 'circle',
  showBadge = false,
  disabled = false,
}: IconButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isPrimary = variant === 'primary';
  // Visual size can be smaller than the 44pt accessibility minimum touch
  // target (e.g. the 32px card arrow) - hitSlop makes up the difference
  // rather than forcing every icon button to look 44px.
  const hitSlopAmount = Math.max(0, Math.ceil((44 - size) / 2));

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      haptic={disabled ? false : 'light'}
      disabled={disabled}
      hitSlop={hitSlopAmount}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        shadows.card,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : radii.lg,
          backgroundColor: isPrimary ? colors.primary : colors.surface,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon
        size={iconSize ?? Math.round(size * 0.45)}
        color={isPrimary ? colors.textOnPrimary : colors.primary}
        strokeWidth={2.25}
      />
      {showBadge ? <View style={styles.badge} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
