import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Badge } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { track } from '@/services/analytics/analytics';
import type { CultureMaterialRow } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type MaterialDetailScreenProps = {
  material: CultureMaterialRow;
  onPressBack: () => void;
};

/** Modeled directly on CultureItemDetailScreen - same accuracy badge,
 * hero-image, sources-list, and "pending research" fallback pattern, for
 * culture_materials rows instead of culture_items rows (the two content
 * tables aren't unified - see the audit's note on why). */
export function MaterialDetailScreen({ material, onPressBack }: MaterialDetailScreenProps) {
  const { t } = useTranslation();

  useEffect(() => {
    track('culture_material_open', { materialId: material.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsScreenLayout title={material.title} onPressBack={onPressBack}>
      <View style={styles.headerBlock}>
        <Badge label={t(`culture.materials.types.${material.kind}`)} color={colors.surfaceAlt} textColor={colors.primary} />
        <Badge label={t(`culture.item.accuracy.${material.accuracy_level}`)} color={colors.surfaceAlt} textColor={colors.textSecondary} />
      </View>

      {material.image_url ? (
        <ExpoImage source={{ uri: material.image_url }} style={styles.hero} contentFit="cover" cachePolicy="disk" />
      ) : null}

      {material.body ? (
        <Text style={styles.body}>{material.body}</Text>
      ) : (
        <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
      )}

      {material.sources && material.sources.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('culture.item.sourcesLabel')}</Text>
          {material.sources.map((url) => (
            <AnimatedPressable key={url} onPress={() => Linking.openURL(url)} accessibilityRole="link">
              <Text style={styles.sourceLink} numberOfLines={1}>
                {url}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hero: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  pending: {
    ...typography.body,
    color: colors.textSecondary,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  sourceLink: {
    ...typography.small,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
