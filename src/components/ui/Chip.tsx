import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';
import { useMinTarget } from '@/services/comfort/useComfortStore';

/**
 * Chips (design system v2) - two visibly different kinds:
 *   interactive  (onPress given) outlined/filled, 36 pt visual + hitSlop to
 *                44 pt, selected state exposed to screen readers
 *   informational (no onPress) quiet tonal label, not a button
 */
export function Chip({ label, icon, selected = false, onPress, accessibilityRole = 'button', testID }: { label: string; icon?: ReactNode; selected?: boolean; onPress?: () => void; accessibilityRole?: 'button' | 'tab'; testID?: string }) {
  const target = useMinTarget();
  const larger = target > 44;
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
      testID={testID}
      style={[styles.chip, larger && styles.chipLarge, selected && styles.chipSelected]}
      hitSlop={Math.max(4, Math.ceil((target - (larger ? 48 : 38)) / 2))}
      onPress={onPress}
      press="strong"
      haptic="light"
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      // react-native-web reads only aria-* (accessibilityState is dropped on web).
      aria-selected={selected}
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
  chipLarge: { minHeight: 48 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, flexShrink: 0 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  textSelected: { color: colors.textOnDark },
  info: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  infoText: { ...textStyles.small, color: colors.textSecondary },
});
