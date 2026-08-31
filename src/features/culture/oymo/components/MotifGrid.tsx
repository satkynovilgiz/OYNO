import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

import { OYMO_MOTIFS, type OymoMotifId } from '../motifs';

type MotifGridProps = {
  selectedMotifId: OymoMotifId;
  onSelectMotif: (id: OymoMotifId) => void;
  color: string;
};

export function MotifGrid({ selectedMotifId, onSelectMotif, color }: MotifGridProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.grid}>
      {OYMO_MOTIFS.map((motif) => {
        const isSelected = motif.id === selectedMotifId;
        return (
          <AnimatedPressable
            key={motif.id}
            style={[styles.tile, isSelected && styles.tileSelected]}
            onPress={() => onSelectMotif(motif.id)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(motif.nameKey)}
            accessibilityState={{ selected: isSelected }}
          >
            <motif.Shape size={28} color={color} />
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
    width: 48,
    height: 48,
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
