import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureMaterial } from '../types';

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
        <AnimatedPressable style={styles.seeAll} onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {materials.map((material) => (
          <AnimatedPressable
            key={material.id}
            style={styles.card}
            onPress={() => onPressMaterial?.(material)}
            accessibilityRole="button"
            accessibilityLabel={material.title}
          >
            <Image source={material.imageSource} style={styles.image} resizeMode="cover" />
            <Text style={styles.title} numberOfLines={1}>
              {material.title}
            </Text>
            <Text style={styles.meta}>
              {t(`culture.materials.types.${material.type}`)} · {t('culture.materials.duration', { count: material.durationMinutes })}
            </Text>
          </AnimatedPressable>
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
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    width: 110,
    gap: 2,
  },
  image: {
    width: 110,
    height: 78,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
  },
});
