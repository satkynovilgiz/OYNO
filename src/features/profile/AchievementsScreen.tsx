import { ChevronLeft, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn, IconButton, ProgressRing } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { AchievementDetailSheet } from './components';
import { achievementsTotal, profileAchievements } from './data';
import type { ProfileAchievement } from './types';

type AchievementsScreenProps = {
  unlockedIds: string[];
  onPressBack: () => void;
};

/** Premium achievement collection (spec "Task 11... do NOT make this look
 * like Settings, a plain list, or four generic cards") - the summary band
 * uses OYNO's deep-green SPECIAL surface instead of another cream card,
 * and every medal shows its full artwork (locked ones dimmed, never
 * hidden). Tapping a medal opens `AchievementDetailSheet` instead of a
 * fifth full screen. Same `profileAchievements` catalog the Profile
 * preview uses - no separate artwork mapping to keep in sync. */
export function AchievementsScreen({ unlockedIds, onPressBack }: AchievementsScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ProfileAchievement | null>(null);
  const unlockedCount = unlockedIds.length;
  const overallProgress = achievementsTotal > 0 ? unlockedCount / achievementsTotal : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>

        <View style={styles.summaryBand}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
          </View>
          <ProgressRing progress={overallProgress} size={56} strokeWidth={4} trackColor="rgba(255,255,255,0.16)" fillColor={colors.accentGold}>
            <Text style={styles.summaryPercent}>{Math.round(overallProgress * 100)}%</Text>
          </ProgressRing>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>{t('profile.achievements.title')}</Text>
            <Text style={styles.summaryCount}>{t('profile.achievements.unlocked', { unlocked: unlockedCount, total: achievementsTotal })}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {profileAchievements.map((achievement, index) => {
            const unlocked = unlockedIds.includes(achievement.id);
            return (
              <FadeSlideIn key={achievement.id} style={styles.itemWrap} index={index}>
                <AnimatedPressable
                  style={styles.item}
                  pressScale={0.97}
                  hoverEffect
                  haptic="light"
                  onPress={() => setSelected(achievement)}
                  accessibilityRole="button"
                  accessibilityLabel={achievement.title}
                >
                  <View style={styles.badgeStage}>
                    <Image
                      source={achievement.iconSource}
                      style={[styles.badgeImage, !unlocked && styles.badgeLocked]}
                      resizeMode="contain"
                    />
                    {!unlocked ? (
                      <View style={styles.lockBadge}>
                        <Lock size={13} color={colors.textOnDark} strokeWidth={2.25} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.label, !unlocked && styles.labelLocked]} numberOfLines={2}>
                    {achievement.title}
                  </Text>
                </AnimatedPressable>
              </FadeSlideIn>
            );
          })}
        </View>
      </ScrollView>

      <AchievementDetailSheet
        achievement={selected}
        unlocked={!!selected && unlockedIds.includes(selected.id)}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
  },
  summaryBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xxl,
    padding: spacing.md,
  },
  ornamentRow: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  summaryPercent: {
    ...typography.caption,
    color: colors.textOnDark,
    fontWeight: '700',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    ...typography.overline,
    color: colors.accentGold,
  },
  summaryCount: {
    ...typography.h2,
    color: colors.textOnDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  itemWrap: {
    width: '47%',
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeStage: {
    width: '100%',
    aspectRatio: 1,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
  // Moderate desaturation only (spec "Task fix... locked state washes out
  // too much") - the medal stays clearly recognizable.
  badgeLocked: {
    opacity: 0.55,
  },
  lockBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(19,32,24,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  labelLocked: {
    color: colors.textMuted,
  },
});
