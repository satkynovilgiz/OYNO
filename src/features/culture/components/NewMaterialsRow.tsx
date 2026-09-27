import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CompactContentCard, TextButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { CultureMaterial } from '../types';

type NewMaterialsRowProps = {
  materials: CultureMaterial[];
  onPressMaterial?: (material: CultureMaterial) => void;
  onPressSeeAll?: () => void;
};

const GAP = spacing.sm;

/** One width for every card: two full cards plus a clear ~30% of the next,
 * so the row reads as scrollable without accidental slivers. */
export function materialCardWidth(screenWidth: number): number {
  return Math.round(Math.min(180, Math.max(140, (screenWidth - spacing.md - GAP * 2) / 2.3)));
}

export function NewMaterialsRow({ materials, onPressMaterial, onPressSeeAll }: NewMaterialsRowProps) {
  const { t } = useTranslation();
  const cardWidth = materialCardWidth(useWindowDimensions().width);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('culture.materials.title')}</Text>
        {onPressSeeAll ? (
          <TextButton
            label={t('common.seeAll')}
            onPress={onPressSeeAll}
            trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
          />
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
      >
        {materials.map((material) => (
          <CompactContentCard
            key={material.id}
            imageSource={material.imageSource}
            width={cardWidth}
            title={material.title}
            meta={`${t(`culture.materials.types.${material.type}`)} · ${t('culture.materials.duration', { count: material.durationMinutes })}`}
            onPress={() => onPressMaterial?.(material)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: GAP,
    alignItems: 'flex-start',
  },
});
