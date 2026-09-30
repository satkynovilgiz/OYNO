import { router, usePathname } from 'expo-router';
import { Headphones, Pause, Play, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarLayout } from '@/components/navigation/tabBarLayout';
import { AnimatedPressable } from '@/components/ui';
import { useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, elevation, radii, spacing, typography } from '@/theme';

import { miniPlayerPlacement } from './miniPlayerPlacement';

/**
 * The compact "still listening" bar: once the listener leaves the screen
 * whose full player is playing, the same session continues here - title,
 * play/pause, close. Tapping the title reopens that screen. It floats above
 * the tab bar on tab screens (never over it), sits at the bottom of other
 * reading screens, and is hidden on games, labs, the full map, sign-in and
 * admin. Mounted once at the root.
 */
export function AudioMiniPlayer() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const tabBarHeight = useTabBarLayout((state) => state.height);
  const sessionKey = useAudioGuideStore((state) => state.sessionKey);
  const meta = useAudioGuideStore((state) => state.meta);
  const status = useAudioGuideStore((state) => state.status);
  const progress = useAudioGuideStore((state) => state.progress);
  const hosted = useAudioGuideStore((state) => (state.sessionKey ? (state.hosts[state.sessionKey] ?? 0) > 0 : false));

  const placement = miniPlayerPlacement(pathname);
  if (!sessionKey || !meta || hosted || !placement || status === 'idle') return null;

  const store = useAudioGuideStore.getState();
  const isPlaying = status === 'playing';
  const bottom = (placement === 'aboveTabBar' ? tabBarHeight : 0) + insets.bottom + spacing.xs;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(220)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      style={[styles.bar, { bottom }]}
      accessibilityLabel={t('audioGuide.miniPlayer')}
    >
      <AnimatedPressable
        style={styles.info}
        onPress={() => meta.route && router.navigate(meta.route as never)}
        disabled={!meta.route}
        accessibilityRole="button"
        accessibilityLabel={`${t('audioGuide.title')}: ${meta.title}`}
        accessibilityHint={meta.route ? t('audioGuide.openContent') : undefined}
      >
        <Headphones size={16} color={colors.accentGold} strokeWidth={2.25} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {meta.title}
          </Text>
          <Text style={styles.state} numberOfLines={1}>
            {status === 'finished' ? t('audioGuide.finished') : status === 'error' ? t('audioGuide.error') : isPlaying ? t('audioGuide.title') : t('audioGuide.paused')}
          </Text>
        </View>
      </AnimatedPressable>
      <AnimatedPressable
        style={styles.play}
        onPress={store.toggle}
        press="strong"
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('audioGuide.pause') : status === 'paused' ? t('audioGuide.resume') : t('audioGuide.play')}
      >
        {isPlaying ? <Pause size={16} color={colors.accentGold} strokeWidth={2.5} /> : <Play size={16} color={colors.accentGold} strokeWidth={2.5} />}
      </AnimatedPressable>
      <AnimatedPressable style={styles.close} onPress={() => store.stop()} hitSlop={6} press="strong" accessibilityRole="button" accessibilityLabel={t('audioGuide.stop')}>
        <X size={16} color={colors.textOnDarkSecondary} strokeWidth={2.25} />
      </AnimatedPressable>
      <View style={[styles.progress, { width: `${Math.round(progress * 100)}%` }]} pointerEvents="none" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceFeature,
    ...elevation.floating,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  state: {
    ...typography.small,
    color: colors.textOnDarkSecondary,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,243,227,0.12)',
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.accentGold,
  },
});
