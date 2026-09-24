import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, CompletionSheet } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

export type ResultStat = { label: string; value: string };

/** How the round ended - decides the tone, never the numbers. */
export type ResultOutcome = 'win' | 'completed' | 'tryAgain';

type ResultScreenProps = {
  visible: boolean;
  title: string;
  /** How it ended. Default 'completed' (a finished round, no winner). */
  outcome?: ResultOutcome;
  /** A short celebratory line (e.g. "New personal best!"). */
  banner?: string;
  /** Real values only - each game passes what it actually measured. */
  stats: ResultStat[];
  onReplay: () => void;
  onExit: () => void;
};

/**
 * Shared result sheet for every 3D game.
 *   win       - a small OYNO seal settles in + success haptic
 *   completed - the seal, calmer, + success haptic
 *   tryAgain  - no seal, an encouraging line, a gentle haptic; "Play
 *               again" leads. No penalty is implied (none exists).
 * Restrained: one short seal animation (skipped under Reduce Motion), no
 * confetti or casino effects. Actions: Play again / Back to games.
 */
export function ResultScreen({ visible, title, outcome = 'completed', banner, stats, onReplay, onExit }: ResultScreenProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const sealScale = useSharedValue(1);
  const sealOpacity = useSharedValue(1);
  const celebrate = outcome !== 'tryAgain';

  useEffect(() => {
    if (!visible || !celebrate) return;
    if (reducedMotion) {
      sealScale.value = 1;
      sealOpacity.value = 1;
      return;
    }
    sealScale.value = 0.6;
    sealOpacity.value = 0;
    sealOpacity.value = withDelay(120, withTiming(1, { duration: 220 }));
    sealScale.value = withDelay(120, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [visible, celebrate, reducedMotion, sealScale, sealOpacity]);

  const sealStyle = useAnimatedStyle(() => ({ opacity: sealOpacity.value, transform: [{ scale: sealScale.value }] }));

  return (
    <CompletionSheet visible={visible} haptic={celebrate ? 'success' : 'light'}>
      <ScrollView contentContainerStyle={styles.content} bounces={false} style={styles.scroll}>
        {celebrate ? (
          <Animated.View style={[styles.seal, outcome === 'win' && styles.sealWin, sealStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <OymoOrnament size={34} color={outcome === 'win' ? colors.textPrimary : colors.accentGold} strokeWidth={1.75} />
          </Animated.View>
        ) : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{t(`games3d.result.outcome.${outcome}`)}</Text>
        {banner ? <Text style={styles.banner}>{banner}</Text> : null}

        {stats.length > 0 ? (
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label={t('games3d.result.replay')} onPress={onReplay} />
          <Button label={t('games3d.result.exit')} variant="secondary" onPress={onExit} />
        </View>
      </ScrollView>
    </CompletionSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  content: { alignItems: 'center', gap: spacing.sm },
  seal: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.accentGold, backgroundColor: colors.surfaceFeature },
  sealWin: { backgroundColor: colors.accentGold, borderColor: colors.accentGoldPressed },
  title: { fontFamily: fontFamily.wordmark, fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xxs },
  banner: { ...typography.small, color: colors.accentGoldPressed, fontWeight: '700', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', width: '100%', marginTop: spacing.xs },
  statCard: { minWidth: 88, alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 },
  statValue: { ...typography.h1, color: colors.primary, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.small, color: colors.textSecondary },
  actions: { gap: spacing.sm, width: '100%', marginTop: spacing.xs },
});
