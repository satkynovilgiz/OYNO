import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { CultureItemRow } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CultureCategoryScreenProps = {
  categoryTitle: string;
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
                {groupItems.map((item) => (
                  <AnimatedPressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => onPressItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </AnimatedPressable>
                ))}
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
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  rowTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
