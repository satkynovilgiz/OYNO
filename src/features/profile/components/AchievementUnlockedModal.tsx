import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!achievement) return;
    // One success tap per real unlock (the modal shows only for new ones).
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility?.(`${t('profile.achievements.unlockedTitle')} ${t(achievement.titleKey)}`);

    // Reduce Motion: show the badge and a steady glow at once - no spring,
    // no endless breathing loop.
    if (reducedMotion) {
      badgeScale.value = 1;
      glowScale.value = 1.15;
      glowOpacity.value = 0.55;
      contentOpacity.value = withTiming(1, { duration: 150 });
      contentTranslateY.value = 0;
      return;
    }

    badgeScale.value = 0.4;
    glowScale.value = 0.8;
    glowOpacity.value = 0;
    contentOpacity.value = 0;
    contentTranslateY.value = 8;

    badgeScale.value = withSpring(1, { damping: 9, stiffness: 140 });
    contentOpacity.value = withDelay(120, withTiming(1, { duration: 260 }));
    contentTranslateY.value = withDelay(120, withTiming(0, { duration: 260 }));
    glowOpacity.value = withDelay(60, withTiming(0.55, { duration: 300 }));
    // One gentle settle - no endless breathing loop.
    glowScale.value = withDelay(60, withSequence(withTiming(1.2, { duration: 380 }), withTiming(1.12, { duration: 420 })));
  }, [achievement, reducedMotion, badgeScale, glowScale, glowOpacity, contentOpacity, contentTranslateY]);

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
              {achievement && <Image source={achievement.iconSource} style={styles.badge} resizeMode="contain" />}
            </Animated.View>
          </View>

          <Animated.View style={[styles.textBlock, contentStyle]}>
            <Text style={styles.title}>{achievement ? t(achievement.titleKey) : null}</Text>
            {achievement ? <Text style={styles.earnedBy}>{t('profile.achievements.v2.earnedBy', { requirement: t(achievement.requirementKey) })}</Text> : null}
          </Animated.View>

          <View style={styles.cta}>
            <Button label={t('profile.achievements.unlockedCta')} variant="accent" block onPress={onDismiss} />
          </View>
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
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  textBlock: {
    alignItems: 'center',
    gap: 4,
  },
  earnedBy: {
    ...typography.caption,
    color: colors.textOnDarkSecondary,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
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
    backgroundColor: 'rgba(232,185,61,0.35)',
  },
  badgeRing: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...typography.h1,
    fontFamily: fontFamily.wordmark,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});
