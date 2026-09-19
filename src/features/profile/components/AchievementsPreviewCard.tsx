import { ChevronRight, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, TextButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

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
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {t('profile.achievements.title')}
          </Text>
          <Text style={styles.unlocked}>{t('profile.achievements.unlocked', { unlocked, total })}</Text>
        </View>
        <TextButton
          label={t('common.seeAll')}
          onPress={onPressSeeAll}
          trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
        />
      </View>

      <View style={styles.grid}>
        {achievements.map((achievement, index) => {
          const isLocked = !!unlockedIds && !unlockedIds.includes(achievement.id);
          return (
            <FadeSlideIn key={achievement.id} style={styles.badgeItem} index={index}>
              <View style={styles.badgeStage}>
                <Image
                  source={achievement.iconSource}
                  style={[styles.badgeImage, isLocked && styles.badgeLocked]}
                  resizeMode="contain"
                />
                {isLocked ? (
                  <View style={styles.lockBadge}>
                    <Lock size={11} color={colors.textOnDark} strokeWidth={2.25} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {achievement.title}
              </Text>
            </FadeSlideIn>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerText: {
    flexShrink: 1,
    gap: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  unlocked: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badgeItem: {
    alignItems: 'center',
    gap: spacing.xxs,
    width: 84,
  },
  // No extra ring/border here - the medallion artwork already has its own
  // ornate gold ring baked in (spec "Task 10... avoid tiny image inside
  // another unnecessary circle... double gold rings"). `contain` shows
  // the full circular medal - the source is already square, so nothing
  // is cropped or stretched.
  badgeStage: {
    width: 84,
    height: 84,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
  badgeLocked: {
    opacity: 0.45,
  },
  lockBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(19,32,24,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
