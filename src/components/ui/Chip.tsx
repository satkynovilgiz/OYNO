import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

/**
 * Chips (design system v2) - two visibly different kinds:
 *   interactive  (onPress given) outlined/filled, 36 pt visual + hitSlop to
 *                44 pt, selected state exposed to screen readers
 *   informational (no onPress) quiet tonal label, not a button
 */
export function Chip({ label, icon, selected = false, onPress, accessibilityRole = 'button' }: { label: string; icon?: ReactNode; selected?: boolean; onPress?: () => void; accessibilityRole?: 'button' | 'tab' }) {
  if (!onPress) {
    return (
      <View style={styles.info}>
        {icon}
        <Text style={styles.infoText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }
  return (
    <AnimatedPressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      press="strong"
      haptic="light"
      hitSlop={4}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, flexShrink: 0 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  textSelected: { color: colors.textOnDark },
  info: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  infoText: { ...textStyles.small, color: colors.textSecondary },
});
