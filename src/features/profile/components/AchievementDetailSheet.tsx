import { CircleCheck, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { ProfileAchievement } from '../types';

type AchievementDetailSheetProps = {
  achievement: ProfileAchievement | null;
  unlocked: boolean;
  onClose: () => void;
};

/** Lightweight reusable detail view for a tapped achievement (spec "Task
 * 11... if no achievement-detail functionality currently exists, create a
 * lightweight reusable detail sheet/modal rather than another giant
 * screen") - one modal, driven entirely by whichever achievement was
 * tapped, not five separate screens. Shows the real requirement text for
 * a locked achievement (mirrors the actual predicate in
 * services/progress/achievements.ts) or a simple unlocked confirmation -
 * never an invented description or reward, since neither exists in the
 * data model. */
export function AchievementDetailSheet({ achievement, unlocked, onClose }: AchievementDetailSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={!!achievement} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />
            <OymoOrnament size={13} color={colors.accentGold} strokeWidth={1.5} />
            <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />
          </View>

          {achievement ? (
            <>
              <View style={styles.badgeStage}>
                <Image source={achievement.iconSource} style={[styles.badgeImage, !unlocked && styles.badgeLocked]} resizeMode="contain" />
              </View>

              <Text style={styles.title}>{achievement.title}</Text>

              <View style={[styles.statusPill, unlocked ? styles.statusPillUnlocked : styles.statusPillLocked]}>
                {unlocked ? (
                  <CircleCheck size={14} color={colors.textOnPrimary} strokeWidth={2.25} />
                ) : (
                  <Lock size={13} color={colors.textOnDark} strokeWidth={2.25} />
                )}
                <Text style={[styles.statusText, unlocked && styles.statusTextUnlocked]}>
                  {t(unlocked ? 'profile.achievements.unlockedBadge' : 'profile.achievements.lockedBadge')}
                </Text>
              </View>

              {!unlocked ? (
                <View style={styles.requirementBlock}>
                  <Text style={styles.requirementLabel}>{t('profile.achievements.requirementLabel')}</Text>
                  <Text style={styles.requirementText}>{t(achievement.requirementKey)}</Text>
                </View>
              ) : null}

              <Button label={t('common.back')} variant="secondary" onPress={onClose} />
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(19,32,24,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accentGold,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeStage: {
    width: 140,
    height: 140,
    marginVertical: spacing.xs,
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
  badgeLocked: {
    opacity: 0.55,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusPillLocked: {
    backgroundColor: colors.accentBrown,
  },
  statusPillUnlocked: {
    backgroundColor: colors.primary,
  },
  statusText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  statusTextUnlocked: {
    color: colors.textOnPrimary,
  },
  requirementBlock: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: 2,
    alignItems: 'center',
  },
  requirementLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  requirementText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
