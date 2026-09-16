import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Card, FadeSlideIn, ProgressRing } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { colors, radii, spacing, typography } from '@/theme';

import { achievementsTotal, profileAchievements } from './data';

type AchievementsScreenProps = {
  unlockedIds: string[];
  onPressBack: () => void;
};

/** Full achievement catalog. Only `profileAchievements` (4 ids) have real,
 * checkable unlock conditions right now - see src/services/progress. */
export function AchievementsScreen({ unlockedIds, onPressBack }: AchievementsScreenProps) {
  const { t } = useTranslation();
  const unlockedCount = unlockedIds.length;
  const overallProgress = achievementsTotal > 0 ? unlockedCount / achievementsTotal : 0;

  return (
    <SettingsScreenLayout title={t('profile.achievements.title')} onPressBack={onPressBack}>
      <Card style={styles.summaryCard}>
        <ProgressRing progress={overallProgress} size={56} strokeWidth={4}>
          <Text style={styles.summaryPercent}>{Math.round(overallProgress * 100)}%</Text>
        </ProgressRing>
        <View style={styles.summaryText}>
          <View style={styles.summaryOrnamentRow}>
            <OymoOrnament size={12} color={colors.accentGold} />
            <Text style={styles.summaryLabel}>{t('profile.achievements.title')}</Text>
          </View>
          <Text style={styles.summaryCount}>
            {t('profile.achievements.unlocked', { unlocked: unlockedCount, total: achievementsTotal })}
          </Text>
        </View>
      </Card>

      <View style={styles.grid}>
        {profileAchievements.map((achievement, index) => {
          const unlocked = unlockedIds.includes(achievement.id);
          return (
            <FadeSlideIn key={achievement.id} style={styles.itemWrap} index={index}>
              <Card style={[styles.item, unlocked && styles.itemUnlocked]} padded={false}>
                <View style={[styles.badgeWrap, !unlocked && styles.badgeLocked]}>
                  <Image source={achievement.iconSource} style={styles.badgeImage} resizeMode="cover" />
                  {unlocked ? (
                    <View style={styles.ornamentBadge}>
                      <OymoOrnament size={12} color={colors.accentGold} />
                    </View>
                  ) : (
                    <View style={styles.lockOverlay}>
                      <Lock size={18} color={colors.textOnDark} strokeWidth={2} />
                    </View>
                  )}
                </View>
                <Text style={[styles.label, !unlocked && styles.labelLocked]} numberOfLines={2}>
                  {achievement.title}
                </Text>
                <Text style={styles.status}>
                  {t(unlocked ? 'profile.achievements.unlockedBadge' : 'profile.achievements.lockedBadge')}
                </Text>
              </Card>
            </FadeSlideIn>
          );
        })}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryPercent: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  summaryLabel: {
    ...typography.overline,
    color: colors.accentGold,
  },
  summaryCount: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemWrap: {
    width: '47%',
  },
  item: {
    alignItems: 'center',
    gap: spacing.xxs,
    padding: spacing.md,
  },
  itemUnlocked: {
    borderColor: colors.accentGold,
    borderWidth: 1.5,
  },
  badgeWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
  },
  ornamentBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20,14,8,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  labelLocked: {
    color: colors.textMuted,
  },
  status: {
    ...typography.small,
    color: colors.textMuted,
  },
});
