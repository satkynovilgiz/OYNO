import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

import { SHYRDAK_PATTERNS, type ShyrdakPatternId } from '../patterns';

type PatternGridProps = {
  selectedPatternId: string;
  onSelectPattern: (id: ShyrdakPatternId) => void;
  color: string;
};

export function PatternGrid({ selectedPatternId, onSelectPattern, color }: PatternGridProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.grid}>
      {SHYRDAK_PATTERNS.map((pattern) => {
        const isSelected = pattern.id === selectedPatternId;
        return (
          <AnimatedPressable
            key={pattern.id}
            style={[styles.tile, isSelected && styles.tileSelected]}
            onPress={() => onSelectPattern(pattern.id)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(pattern.nameKey)}
            accessibilityState={{ selected: isSelected }}
          >
            <pattern.Shape size={32} color={color} />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  tileSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
});
