import { useTranslation } from 'react-i18next';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { ProfileAchievement } from '../types';

type AchievementUnlockedModalProps = {
  achievement: ProfileAchievement | null;
  onDismiss: () => void;
};

/** Fires whenever useProgressStore unlocks a real achievement, regardless of
 * which screen the user is on - mounted once at the root layout. */
export function AchievementUnlockedModal({ achievement, onDismiss }: AchievementUnlockedModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={achievement !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>{t('profile.achievements.unlockedTitle')}</Text>
          {achievement && <Image source={achievement.iconSource} style={styles.badge} resizeMode="cover" />}
          <Text style={styles.title}>{achievement?.title}</Text>
          <Button label={t('profile.achievements.unlockedCta')} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
