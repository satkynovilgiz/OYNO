import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { EYE_COLOR_SWATCHES, HAIR_COLOR_SWATCHES, SKIN_TONE_SWATCHES, swatchCheckColor } from '@/services/avatar/avatarColors';
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
 * a color picker, unlike every ItemGrid category. Selection is shown by a
 * gold ring AND a check (never colour alone); each swatch has a spoken
 * name (skin tones by position, light to dark). */
export function ColorSwatchGrid({ fieldId, selectedId, onSelect }: ColorSwatchGridProps) {
  const { t } = useTranslation();
  const swatches = SWATCH_LISTS[fieldId];
  return (
    <View style={styles.row}>
      {swatches.map((swatch, index) => {
        const isSelected = swatch.id === selectedId;
        const label =
          fieldId === 'skinTone'
            ? t('avatar.swatchSkin', { index: index + 1, total: swatches.length })
            : `${t(`avatar.sections.${fieldId}`)}: ${t(`avatar.colorNames.${swatch.id}`)}`;
        return (
          <AnimatedPressable
            key={swatch.id}
            style={[styles.swatchTarget, isSelected && styles.swatchSelected]}
            onPress={() => onSelect(swatch.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={label}
          >
            <View style={[styles.swatch, { backgroundColor: swatch.hex }]}>
              {isSelected && <Check size={18} color={swatchCheckColor(swatch.hex)} strokeWidth={3} />}
            </View>
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
  // 48pt touch target with the colour inset, so the gold selection ring
  // sits around the swatch instead of over it.
  swatchTarget: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatch: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  swatchSelected: {
    borderColor: colors.accentGold,
  },
});
