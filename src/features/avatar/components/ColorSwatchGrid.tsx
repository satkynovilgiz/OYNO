import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { EYE_COLOR_SWATCHES, HAIR_COLOR_SWATCHES, SKIN_TONE_SWATCHES } from '@/services/avatar/avatarColors';
import { colors, spacing } from '@/theme';

import type { AvatarColorFieldId } from '../types';

const SWATCH_LISTS: Record<AvatarColorFieldId, { id: string; hex: string }[]> = {
  skinTone: SKIN_TONE_SWATCHES,
  hairColor: HAIR_COLOR_SWATCHES,
  eyeColor: EYE_COLOR_SWATCHES,
};

type ColorSwatchGridProps = {
  fieldId: AvatarColorFieldId;
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Real, finished UI (not a placeholder) - no illustration is needed for
 * a color picker, unlike every ItemGrid category. */
export function ColorSwatchGrid({ fieldId, selectedId, onSelect }: ColorSwatchGridProps) {
  return (
    <View style={styles.row}>
      {SWATCH_LISTS[fieldId].map((swatch) => {
        const isSelected = swatch.id === selectedId;
        return (
          <AnimatedPressable
            key={swatch.id}
            style={[styles.swatch, { backgroundColor: swatch.hex }, isSelected && styles.swatchSelected]}
            onPress={() => onSelect(swatch.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={swatch.id}
          >
            {isSelected && <Check size={16} color={colors.textOnPrimary} strokeWidth={3} />}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  swatchSelected: {
    borderColor: colors.accentGold,
    borderWidth: 3,
  },
});
