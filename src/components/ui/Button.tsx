import { type ReactNode, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'text' | 'destructive' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /**
   * primary     forest fill (default app action)
   * accent      gold fill + dark text - the ONE hero/reward action on a screen
   * secondary   cream surface + forest text
   * ghost       transparent, forest text, hairline outline
   * text        text only (tertiary)
   * destructive red fill (`danger` is the legacy alias)
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the parent's width. */
  block?: boolean;
  accessibilityHint?: string;
};

const SIZE = {
  sm: { minHeight: 36, paddingHorizontal: spacing.sm, text: textStyles.caption },
  md: { minHeight: 44, paddingHorizontal: spacing.md, text: textStyles.bodyMedium },
  lg: { minHeight: 52, paddingHorizontal: spacing.lg, text: textStyles.title },
} as const;

const VARIANT: Record<Exclude<ButtonVariant, 'danger'>, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary },
  accent: { bg: colors.accentGold, fg: colors.textPrimary },
  secondary: { bg: colors.surfaceElevated, fg: colors.primary, border: colors.borderSubtle },
  ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
  text: { bg: 'transparent', fg: colors.primary },
  destructive: { bg: colors.error, fg: colors.textOnPrimary },
};

/**
 * Labeled button (design system v2). States: normal, pressed (short
 * squeeze + slight dim), disabled, loading. Loading keeps the label laid
 * out (invisible) under the spinner so the button never changes size. For
 * icon-only actions, use IconButton.
 */
export function Button({ label, onPress, icon, disabled = false, loading = false, variant = 'primary', size = 'md', block = false, accessibilityHint }: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const v = VARIANT[variant === 'danger' ? 'destructive' : variant];
  const s = SIZE[size];
  // Small visual size, full 44 pt touch target.
  const hitSlop = Math.max(0, Math.ceil((44 - s.minHeight) / 2));

  return (
    <AnimatedPressable
      style={[
        styles.button,
        { minHeight: s.minHeight, paddingHorizontal: variant === 'text' ? spacing.xxs : s.paddingHorizontal, backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        block && styles.block,
        pressed && !isDisabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={isDisabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      press="strong"
      hitSlop={hitSlop}
      haptic={isDisabled ? false : variant === 'primary' || variant === 'accent' ? 'medium' : 'light'}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {icon}
        <Text style={[s.text, styles.label, { color: v.fg }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {loading ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator size="small" color={v.fg} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 },
});
