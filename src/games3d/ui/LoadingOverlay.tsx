import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, spacing, typography } from '@/theme';

const FADE_MS = 220;

type LoadingOverlayProps = {
  /** Defaults to `true` so an existing `<LoadingOverlay progress={...} />`
   * call site (no `visible` prop at all) keeps behaving exactly as before -
   * always shown for as long as it's mounted. Pass this explicitly (e.g.
   * `visible={modelsLoading}`, always rendered rather than behind a
   * `modelsLoading ? <LoadingOverlay/> : null` ternary) to let the overlay
   * fade itself out instead of vanishing the instant loading finishes
   * (Section "Fade LoadingOverlay out smoothly instead of instantly
   * disappearing"). */
  visible?: boolean;
  progress?: number;
};

/** Full-bleed loading state (Section 64) - never a blank screen while
 * models/assets load. Stays mounted (and touch-blocking) for `FADE_MS`
 * after `visible` goes false so it can fade out instead of popping away,
 * which doubles as "prevent gameplay controls from working while loading"
 * (Section) for every caller: nothing behind an opaque, pointer-blocking
 * overlay is reachable until it's actually gone, fade included - not just
 * for however long `visible` itself was true. One shared implementation,
 * reused as-is by every game that shows it (Jaa Atuu/Kyz Kuumai/Kok Boru
 * today) rather than each hand-rolling its own fade. */
export function LoadingOverlay({ visible = true, progress }: LoadingOverlayProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, { duration: FADE_MS });
      return undefined;
    }
    opacity.value = withTiming(0, { duration: FADE_MS });
    const timer = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(timer);
  }, [visible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, animatedStyle]} pointerEvents="auto">
      <ActivityIndicator size="large" color={colors.accentGold} />
      <Text style={styles.text}>{t('games3d.loading.title')}</Text>
      {typeof progress === 'number' ? (
        <Text style={styles.progress}>{Math.round(progress * 100)}%</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  progress: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
});
