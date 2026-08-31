import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

const SWATCHES = [
  colors.primary,
  colors.tiles.food,
  colors.accentBrown,
  colors.accentGold,
  colors.textMuted,
  colors.accentBrownDark,
];

type ColorSwatchesProps = {
  selectedColor: string;
  onSelectColor: (color: string) => void;
};

export function ColorSwatches({ selectedColor, onSelectColor }: ColorSwatchesProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {SWATCHES.map((swatch) => (
        <AnimatedPressable
          key={swatch}
          style={[styles.swatch, { backgroundColor: swatch }, swatch === selectedColor && styles.swatchSelected]}
          onPress={() => onSelectColor(swatch)}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('culture.oymo.colorLabel')}
          accessibilityState={{ selected: swatch === selectedColor }}
        >
          {null}
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.textPrimary,
  },
});
