import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { getCollectionCounts, getCollectionItems } from './data';

type CollectionScreenProps = {
  discoveredExploreIds: string[];
  onPressBack: () => void;
};

/** Same real discovery catalog as the Profile preview row - see the doc
 * comment on getCollectionItems in ./data.ts for why this is narrower than
 * the design's eventual full collection. */
export function CollectionScreen({ discoveredExploreIds, onPressBack }: CollectionScreenProps) {
  const { t } = useTranslation();
  const items = getCollectionItems(discoveredExploreIds);
  const { unlocked, total } = getCollectionCounts(discoveredExploreIds);

  return (
    <SettingsScreenLayout title={t('profile.collection.title')} onPressBack={onPressBack}>
      <Text style={styles.subtitle}>{unlocked} / {total}</Text>

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Image source={item.imageSource} style={styles.image} resizeMode="cover" />
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <ProgressBar progress={item.total > 0 ? item.current / item.total : 0} height={6} />
              <Text style={styles.progress}>
                {item.current} / {item.total}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  progress: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
