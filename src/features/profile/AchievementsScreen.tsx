import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { achievementsTotal, profileAchievements } from './data';

type AchievementsScreenProps = {
  unlockedIds: string[];
  onPressBack: () => void;
};

/** Full achievement catalog. Only `profileAchievements` (4 ids) have real,
 * checkable unlock conditions right now - see src/services/progress. */
export function AchievementsScreen({ unlockedIds, onPressBack }: AchievementsScreenProps) {
  const { t } = useTranslation();

  return (
    <SettingsScreenLayout title={t('profile.achievements.title')} onPressBack={onPressBack}>
      <Text style={styles.subtitle}>{t('profile.achievements.unlocked', { unlocked: unlockedIds.length, total: achievementsTotal })}</Text>

      <View style={styles.grid}>
        {profileAchievements.map((achievement) => {
          const unlocked = unlockedIds.includes(achievement.id);
          return (
            <View key={achievement.id} style={styles.item}>
              <View style={[styles.badgeWrap, !unlocked && styles.badgeLocked]}>
                <Image source={achievement.iconSource} style={styles.badgeImage} resizeMode="cover" />
                {!unlocked && (
                  <View style={styles.lockOverlay}>
                    <Lock size={18} color={colors.textOnDark} strokeWidth={2} />
                  </View>
                )}
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {achievement.title}
              </Text>
            </View>
          );
        })}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  item: {
    width: 88,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  badgeWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20,14,8,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
