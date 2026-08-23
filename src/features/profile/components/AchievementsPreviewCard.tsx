import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ProfileAchievement } from '../types';

type AchievementsPreviewCardProps = {
  achievements: ProfileAchievement[];
  unlockedIds?: string[];
  unlocked: number;
  total: number;
  onPressSeeAll?: () => void;
};

export function AchievementsPreviewCard({ achievements, unlockedIds, unlocked, total, onPressSeeAll }: AchievementsPreviewCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {t('profile.achievements.title')}
        </Text>
        <TextButton
          label={t('common.seeAll')}
          hideLabel
          onPress={onPressSeeAll}
          trailingIcon={<ChevronRight size={16} color={colors.primary} strokeWidth={2.25} />}
        />
      </View>
      <Text style={styles.unlocked}>{t('profile.achievements.unlocked', { unlocked, total })}</Text>

      <View style={styles.grid}>
        {achievements.map((achievement) => (
          <View key={achievement.id} style={styles.badgeItem}>
            <Image
              source={achievement.iconSource}
              style={[styles.badgeImage, unlockedIds && !unlockedIds.includes(achievement.id) && styles.badgeLocked]}
              resizeMode="cover"
            />
            <Text style={styles.badgeLabel} numberOfLines={2}>
              {achievement.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xs,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  unlocked: {
    ...typography.small,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badgeItem: {
    alignItems: 'center',
    gap: 2,
    width: 56,
  },
  badgeImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
  },
  badgeLocked: {
    opacity: 0.35,
  },
  badgeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
