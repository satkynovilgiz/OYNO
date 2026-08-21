import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

/** Labeled pill button (e.g. "Сыйлыкты ал"). For icon-only actions, use IconButton. */
export function Button({ label, onPress, icon, disabled = false, loading = false, variant = 'primary' }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? colors.primary : colors.textOnPrimary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    ...shadows.card,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  labelSecondary: {
    color: colors.primary,
  },
});
