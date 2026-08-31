import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { SymmetryMode } from '@/services/culture/oymoEditor';
import { colors, radii, spacing, typography } from '@/theme';

const MODES: { mode: SymmetryMode; labelKey: string }[] = [
  { mode: 'none', labelKey: 'culture.oymo.symmetry.none' },
  { mode: 'mirror', labelKey: 'culture.oymo.symmetry.mirror' },
  { mode: 'fourWay', labelKey: 'culture.oymo.symmetry.fourWay' },
];

type SymmetryControlProps = {
  mode: SymmetryMode;
  onChangeMode: (mode: SymmetryMode) => void;
};

/** 3-way segmented control (Жок / Чагылтуу / Төрт тарап) - a distinct,
 * visible toggle rather than an icon button, per the detailed reference. */
export function SymmetryControl({ mode, onChangeMode }: SymmetryControlProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      {MODES.map(({ mode: candidate, labelKey }) => {
        const isSelected = candidate === mode;
        return (
          <AnimatedPressable
            key={candidate}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={() => onChangeMode(candidate)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{t(labelKey)}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  labelSelected: {
    color: colors.textOnPrimary,
  },
});
