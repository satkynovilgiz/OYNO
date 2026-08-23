import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type TextButtonProps = {
  label: string;
  onPress?: () => void;
  trailingIcon?: ReactNode;
  disabled?: boolean;
  /** 'primary' (bold, primary-colored - e.g. "Баарын көрүү") or 'muted'
   * (bold, secondary-colored - e.g. "Кодду кайра жөнөтүү"). */
  tone?: 'primary' | 'muted';
  /** Keep `label` as the accessible name but don't render it visibly - for
   * space-constrained spots (e.g. a chevron-only "see all" on a narrow
   * card) that still need a real accessibility label instead of none. */
  hideLabel?: boolean;
  /** Layout-only overrides (alignment, margin) for the call site - never
   * used to redefine the button's own look. */
  style?: StyleProp<ViewStyle>;
};

/** Ghost/ text-only button - the "Баарын көрүү ›" / "Сырсөздү унуттуңузбу?"
 * pattern. Was independently re-implemented (several as bare `Text
 * onPress`, with zero press feedback) across a dozen screens; this is the
 * single shared version. Always gets a real hit target via hitSlop even
 * though the visible label is small. */
export function TextButton({
  label,
  onPress,
  trailingIcon,
  disabled = false,
  tone = 'primary',
  hideLabel = false,
  style,
}: TextButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <AnimatedPressable
      style={[styles.row, style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      haptic={disabled ? false : 'light'}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {hideLabel ? null : <Text style={[styles.label, tone === 'muted' && styles.labelMuted]}>{label}</Text>}
      {trailingIcon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  labelMuted: {
    color: colors.textSecondary,
  },
});
