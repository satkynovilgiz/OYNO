import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompactContentCard, TextButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { CultureMaterial } from '../types';

/** Matches CompactContentCard's fixed width so the row snaps one card at a time. */
const COMPACT_CARD_WIDTH = 128;

type NewMaterialsRowProps = {
  materials: CultureMaterial[];
  onPressMaterial?: (material: CultureMaterial) => void;
  onPressSeeAll?: () => void;
};

export function NewMaterialsRow({ materials, onPressMaterial, onPressSeeAll }: NewMaterialsRowProps) {
  const { t } = useTranslation();

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
        snapToInterval={COMPACT_CARD_WIDTH + spacing.sm}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {materials.map((material) => (
          <CompactContentCard
            key={material.id}
            imageSource={material.imageSource}
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
    gap: spacing.sm,
  },
});
