import { Pressable, StyleSheet, Text } from 'react-native';

import { radii, spacing, typography } from '@/theme';

import { HUD } from './hudTheme';

type Variant = 'primary' | 'secondary' | 'quiet';

/**
 * In-game action button (pause sheet, tutorial): gold filled for the one
 * primary action, a cream-outlined secondary, and a quiet text-style one
 * (Exit). Always a text label - never icon-only - and at least 48 pt tall.
 */
export function HudButton({ label, onPress, variant = 'secondary' }: { label: string; onPress: () => void; variant?: Variant }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed]}
    >
      <Text style={[styles.label, variant === 'primary' ? styles.labelPrimary : variant === 'quiet' ? styles.labelQuiet : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 50, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primary: { backgroundColor: HUD.gold },
  secondary: { borderWidth: 1, borderColor: 'rgba(251,243,227,0.35)', backgroundColor: 'rgba(251,243,227,0.06)' },
  quiet: { minHeight: 44 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label: { ...typography.bodyBold, color: HUD.text },
  labelPrimary: { color: '#1F2A1E' },
  labelQuiet: { color: HUD.textMuted },
});
