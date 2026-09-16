import { Sparkles, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { EmptyState, FadeSlideIn, ProgressBar } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { SupportedLanguage } from '@/i18n';
import { useDiscoveries } from '@/services/content/discoveriesService';
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
  const { t, i18n } = useTranslation();
  const { data: discoveries, isLoading, isError, refetch } = useDiscoveries();
  const items = getCollectionItems(discoveries ?? [], discoveredExploreIds, i18n.language as SupportedLanguage);
  const { unlocked, total } = getCollectionCounts(discoveries ?? [], discoveredExploreIds);

  return (
    <SettingsScreenLayout title={t('profile.collection.title')} onPressBack={onPressBack}>
      {isLoading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          tone="error"
          title={t('explore.loadError')}
          actionLabel={t('common.retry')}
          onPressAction={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t('profile.collection.empty')}
          description={t('profile.collection.emptyDescription')}
        />
      ) : (
        <>
          <Text style={styles.subtitle}>{unlocked} / {total}</Text>

          <View style={styles.list}>
            {items.map((item, index) => (
              <FadeSlideIn key={item.id} index={index}>
                <View style={styles.row}>
                  {item.imageSource ? (
                    <Image source={item.imageSource} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={[styles.image, { backgroundColor: item.color }]} />
                  )}
                  <View style={styles.body}>
                    <Text style={styles.title}>{item.title}</Text>
                    <ProgressBar progress={item.total > 0 ? item.current / item.total : 0} height={6} />
                    <Text style={styles.progress}>
                      {item.current} / {item.total}
                    </Text>
                  </View>
                </View>
              </FadeSlideIn>
            ))}
          </View>
        </>
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
