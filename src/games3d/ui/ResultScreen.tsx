import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, CompletionSheet } from '@/components/ui';
import { PathContinueCard } from '@/features/learn/PathContinueCard';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, fontFamily, radii, spacing, textStyles, typography } from '@/theme';

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
  /** A NEW personal best this round (only when a previous best was
   * beaten - see features/games/records). */
  personalBest?: { value: string; previous: string; onShare?: () => void } | null;
  /** Game Coach: ONE short "Next time, try…" line (never with a new best). */
  coachTip?: string | null;
  /** Practice Academy: the mission's outcome (neutral copy) + its actions. */
  practiceGoal?: { completed: boolean; title: string; progressText: string; onChooseAnother: () => void } | null;
  /** Rendered inside the sheet (e.g. the share preview host, so it opens
   * on top of this sheet rather than beside it). */
  overlay?: ReactNode;
  /** Friend challenge: the target result (neutral wording) and/or the
   * "Challenge a friend" share action. */
  friendChallenge?: { outcome: { beaten: boolean; scoreText: string; targetText: string } | null; onChallengeFriend: (() => void) | null } | null;
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
export function ResultScreen({ visible, title, outcome = 'completed', banner, stats, personalBest, coachTip, practiceGoal, overlay, friendChallenge, onReplay, onExit }: ResultScreenProps) {
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

        {/* New personal best: said in words + a seal, never colour alone. */}
        {personalBest ? (
          <View style={styles.pb} accessible accessibilityLabel={`${t('gameRecords.newPersonalBest')}. ${personalBest.value}. ${t('gameRecords.previousBest', { value: personalBest.previous })}`}>
            <View style={styles.pbRow}>
              <OymoOrnament size={12} color={colors.accentGoldPressed} strokeWidth={2} />
              <Text style={styles.pbKicker}>{t('gameRecords.newPersonalBest')}</Text>
            </View>
            <Text style={styles.pbValue}>{personalBest.value}</Text>
            <Text style={styles.pbPrevious}>{t('gameRecords.previousBest', { value: personalBest.previous })}</Text>
          </View>
        ) : null}
        {personalBest?.onShare ? <Button label={t('gameRecords.sharePersonalBest')} variant="secondary" onPress={personalBest.onShare} /> : null}

        {friendChallenge?.outcome ? (
          <View
            style={styles.challenge}
            accessible
            accessibilityLabel={`${t('friendChallenge.title')}. ${friendChallenge.outcome.beaten ? t('friendChallenge.beaten') : t('friendChallenge.youScored', { score: friendChallenge.outcome.scoreText })}. ${t('friendChallenge.targetValue', { target: friendChallenge.outcome.targetText })}`}
          >
            <Text style={styles.challengeKicker}>{t('friendChallenge.title')}</Text>
            <Text style={styles.challengeTitle}>{friendChallenge.outcome.beaten ? `✓ ${t('friendChallenge.beaten')}` : t('friendChallenge.youScored', { score: friendChallenge.outcome.scoreText })}</Text>
            <Text style={styles.challengeMeta}>{t('friendChallenge.targetValue', { target: friendChallenge.outcome.targetText })}</Text>
          </View>
        ) : null}
        {friendChallenge?.onChallengeFriend ? <Button label={t('friendChallenge.challengeFriend')} variant="secondary" onPress={friendChallenge.onChallengeFriend} /> : null}

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

        {practiceGoal ? (
          <View style={styles.coach} accessible accessibilityLabel={`${practiceGoal.title}. ${practiceGoal.completed ? t('practiceAcademy.goalCompleted') : t('practiceAcademy.yourProgress')} ${practiceGoal.progressText}`}>
            <Text style={styles.coachKicker}>{practiceGoal.completed ? `✓ ${t('practiceAcademy.goalCompleted')}` : t('practiceAcademy.yourProgress')}</Text>
            <Text style={styles.coachText}>
              {practiceGoal.title} · {practiceGoal.progressText}
            </Text>
          </View>
        ) : null}

        {coachTip && !personalBest ? (
          <View style={styles.coach} accessible accessibilityLabel={`${t('gameCoach.nextTime')} ${coachTip}`}>
            <Text style={styles.coachKicker}>{t('gameCoach.nextTime')}</Text>
            <Text style={styles.coachText}>{coachTip}</Text>
          </View>
        ) : null}

        {/* Opened from a Learning Path: the next step (or why this round did not count). Replay/Exit stay as they are. */}
        <PathContinueCard inline />

        <View style={styles.actions}>
          <Button label={practiceGoal ? t('practiceAcademy.tryAgain') : t('games3d.result.replay')} onPress={onReplay} />
          {practiceGoal ? <Button label={t('practiceAcademy.chooseAnother')} variant="secondary" onPress={practiceGoal.onChooseAnother} /> : null}
          <Button label={t('games3d.result.exit')} variant="secondary" onPress={onExit} />
        </View>
      </ScrollView>
      {overlay}
    </CompletionSheet>
  );
}

const styles = StyleSheet.create({
  coach: { alignSelf: 'stretch', gap: 2, padding: spacing.sm, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  coachKicker: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracotta },
  coachText: { ...textStyles.small, color: colors.textPrimary },
  scroll: { width: '100%' },
  content: { alignItems: 'center', gap: spacing.sm },
  seal: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.accentGold, backgroundColor: colors.surfaceAlt },
  sealWin: { backgroundColor: colors.accentGold, borderColor: colors.accentGoldPressed },
  title: { fontFamily: fontFamily.wordmark, fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xxs },
  banner: { ...typography.small, color: colors.accentGoldPressed, fontWeight: '700', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', width: '100%', marginTop: spacing.xs },
  statCard: { minWidth: 88, alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 },
  statValue: { ...typography.h1, color: colors.primary, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.small, color: colors.textSecondary },
  pb: { alignItems: 'center', gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.accentGold, backgroundColor: colors.surfaceAlt },
  pbRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pbKicker: { ...typography.overline, color: colors.accentGoldPressed },
  pbValue: { ...typography.h1, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  pbPrevious: { ...typography.small, color: colors.textSecondary },
  challenge: { alignItems: 'center', gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  challengeKicker: { ...typography.overline, color: colors.accentTerracotta },
  challengeTitle: { ...typography.bodyBold, color: colors.textPrimary },
  challengeMeta: { ...typography.small, color: colors.textSecondary },
  actions: { gap: spacing.sm, width: '100%', marginTop: spacing.xs },
});
