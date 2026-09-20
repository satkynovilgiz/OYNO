import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
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
  const badgeScale = useSharedValue(0.4);
  const glowScale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(8);

  useEffect(() => {
    if (!achievement) return;

    badgeScale.value = 0.4;
    glowScale.value = 0.8;
    glowOpacity.value = 0;
    contentOpacity.value = 0;
    contentTranslateY.value = 8;

    badgeScale.value = withSpring(1, { damping: 9, stiffness: 140 });
    contentOpacity.value = withDelay(120, withTiming(1, { duration: 260 }));
    contentTranslateY.value = withDelay(120, withTiming(0, { duration: 260 }));
    glowOpacity.value = withDelay(60, withTiming(0.55, { duration: 300 }));
    glowScale.value = withDelay(
      60,
      withSequence(
        withTiming(1.15, { duration: 400 }),
        withRepeat(withSequence(withTiming(1.25, { duration: 900 }), withTiming(1.1, { duration: 900 })), -1, true),
      ),
    );
  }, [achievement, badgeScale, glowScale, glowOpacity, contentOpacity, contentTranslateY]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  return (
    <Modal visible={achievement !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.ornamentRow}>
            <OymoOrnament size={12} color={colors.accentGold} />
            <OymoOrnament size={14} color={colors.accentGold} />
            <OymoOrnament size={12} color={colors.accentGold} />
          </View>

          <Text style={styles.eyebrow}>{t('profile.achievements.unlockedTitle')}</Text>

          <View style={styles.badgeStage}>
            <Animated.View style={[styles.glow, glowStyle]} />
            <Animated.View style={[styles.badgeRing, badgeStyle]}>
              {achievement && <Image source={achievement.iconSource} style={styles.badge} resizeMode="cover" />}
            </Animated.View>
          </View>

          <Animated.View style={contentStyle}>
            <Text style={styles.title}>{achievement ? t(achievement.titleKey) : null}</Text>
          </Animated.View>

          <Button label={t('profile.achievements.unlockedCta')} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.6)',
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
    borderWidth: 1,
    borderColor: colors.accentGold,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  badgeStage: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xxs,
  },
  glow: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.accentGold,
  },
  badgeRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 4,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
