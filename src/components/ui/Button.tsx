import { type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
};

/** Labeled pill button (e.g. "Сыйлыкты ал"). For icon-only actions, use IconButton. */
export function Button({ label, onPress, icon }: ButtonProps) {
  return (
    <AnimatedPressable
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
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
  label: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
