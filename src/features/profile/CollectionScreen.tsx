import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { collectionTotal, collectionUnlocked, profileCollection } from './data';

type CollectionScreenProps = {
  onPressBack: () => void;
};

/** Full collection catalog (same 6 categories shown in the Profile preview
 * row). Per-item current/total counts are still a content-catalog mock -
 * they need the full discovery/lesson system to become real; see
 * PROGRESS_AUDIT.md. */
export function CollectionScreen({ onPressBack }: CollectionScreenProps) {
  const { t } = useTranslation();

  return (
    <SettingsScreenLayout title={t('profile.collection.title')} onPressBack={onPressBack}>
      <Text style={styles.subtitle}>{collectionUnlocked} / {collectionTotal}</Text>

      <View style={styles.list}>
        {profileCollection.map((item) => (
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
