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
                    <Lock size={10} color={colors.textOnDark} strokeWidth={2.5} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {t(achievement.titleKey)}
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
  // Fixed-width items + wrap is what turned this into a 3-then-1 layout
  // on normal phone widths (4 * 84px + 3 gaps didn't fit the available
  // width, so the 4th wrapped). No wrap, and each item is an equal `flex:
  // 1` share of the row instead of a hardcoded pixel width, so exactly 4
  // always fit - the medal size itself is however much that leaves per
  // item on that specific screen, not a fixed number (spec "Task fix...
  // responsive sizing based on available screen width").
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
  },
  badgeItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  // No extra ring/border here - the medallion artwork already has its own
  // ornate gold ring baked in (spec "Task 10... avoid tiny image inside
  // another unnecessary circle... double gold rings"). `contain` shows
  // the full circular medal - the source is already square, so nothing
  // is cropped or stretched. `aspectRatio: 1` (not a fixed height) keeps
  // the medal square at whatever width `flex: 1` computed for this
  // screen.
  badgeStage: {
    width: '100%',
    aspectRatio: 1,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
  // Moderate desaturation only (spec "Task fix... locked state washes out
  // too much") - the medal (now genuinely transparent PNG, no more white
  // square behind it) stays clearly recognizable, not washed out.
  badgeLocked: {
    opacity: 0.55,
  },
  lockBadge: {
    position: 'absolute',
    bottom: '4%',
    right: '4%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(19,32,24,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed height for exactly 2 lines (spec "Task fix... reserve
  // consistent title height... do not allow different medal positions
  // because one title has two lines") - every item's label reserves the
  // same vertical space regardless of whether this particular title
  // actually wraps to 1 or 2 lines, so all 4 medals stay level.
  badgeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
});
