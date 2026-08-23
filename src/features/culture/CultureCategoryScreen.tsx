import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { CultureItemRow } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CultureCategoryScreenProps = {
  categoryTitle: string;
  categoryImage?: ImageSourcePropType;
  items: CultureItemRow[];
  isLoading: boolean;
  hasError: boolean;
  onPressBack: () => void;
  onPressItem: (item: CultureItemRow) => void;
};

/** Groups items by subgroup only when there's more than one distinct
 * subgroup present - a single-subgroup category (or one with no subgroup
 * at all) just renders a flat list instead of a redundant one-section
 * header. */
export function CultureCategoryScreen({
  categoryTitle,
  categoryImage,
  items,
  isLoading,
  hasError,
  onPressBack,
  onPressItem,
}: CultureCategoryScreenProps) {
  const { t } = useTranslation();

  const subgroups = Array.from(new Set(items.map((item) => item.subgroup ?? '')));
  const showSubgroupHeaders = subgroups.length > 1;

  return (
    <SettingsScreenLayout title={categoryTitle} onPressBack={onPressBack}>
      {isLoading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : hasError ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('culture.loadError')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('culture.item.pendingResearch')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {subgroups.map((subgroup) => {
            const groupItems = items.filter((item) => (item.subgroup ?? '') === subgroup);
            return (
              <View key={subgroup || 'default'} style={styles.group}>
                {showSubgroupHeaders && subgroup ? (
                  <Text style={styles.groupTitle}>{t(`culture.subgroups.${subgroup}`)}</Text>
                ) : null}
                <View style={styles.itemGrid}>
                  {groupItems.map((item) => (
                    <AnimatedPressable
                      key={item.id}
                      style={styles.card}
                      onPress={() => onPressItem(item)}
                      pressScale={1}
                      hoverEffect
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      <View style={styles.cardInner}>
                        {categoryImage ? (
                          <Image source={categoryImage} style={styles.cardImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.cardImagePlaceholder} />
                        )}
                        <View style={styles.cardBody}>
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          {item.type_label ? (
                            <Text style={styles.cardType}>{t(`culture.item.type.${item.type_label}`)}</Text>
                          ) : null}
                        </View>
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stateBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flexGrow: 0,
    flexBasis: '47%',
    borderRadius: radii.lg,
    ...shadows.card,
  },
  cardInner: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
  },
  cardImagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
  },
  cardBody: {
    padding: spacing.xs,
    gap: 2,
  },
  cardType: {
    ...typography.small,
    color: colors.textMuted,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
