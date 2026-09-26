import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing } from '@/theme';

import { HUD } from './hudTheme';

/**
 * Jaa Atuu draw strength while the player holds - the same min/max hold
 * window the shot's power is computed from (AimController), so a full bar
 * really is full power. Runs on the UI thread (no React render per frame)
 * and is hidden whenever the bow isn't drawn.
 */
export function DrawStrengthMeter({ isDrawing, drawStartedAtMs, minDrawMs, maxDrawMs }: { isDrawing: SharedValue<boolean>; drawStartedAtMs: SharedValue<number>; minDrawMs: number; maxDrawMs: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fill = useSharedValue(0);

  useFrameCallback(() => {
    fill.value = isDrawing.value ? Math.min(1, Math.max(0, (Date.now() - drawStartedAtMs.value - minDrawMs) / (maxDrawMs - minDrawMs))) : 0;
  });

  const containerStyle = useAnimatedStyle(() => ({ opacity: isDrawing.value ? 1 : 0 }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%`, backgroundColor: fill.value >= 1 ? HUD.gold : 'rgba(232,185,61,0.75)' }));

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { bottom: insets.bottom + spacing.lg }, containerStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.label}>{t('games3d.jaaAtuu.drawStrength')}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: HUD.surface, borderWidth: 1, borderColor: HUD.border },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: HUD.textMuted },
  track: { width: 160, height: 6, borderRadius: 3, backgroundColor: 'rgba(251,243,227,0.18)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
