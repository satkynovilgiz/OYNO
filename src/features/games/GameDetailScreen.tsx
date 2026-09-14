import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { getBestScore } from '@/games3d/core/gameBestScore';
import { achievementDefinitions } from '@/services/progress/achievements';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export type GameDetailDifficulty = 'easy' | 'normal' | 'hard';

type GameDetailScreenProps = {
  gameId: string;
  title: string;
  description: string;
  objective: string;
  tutorialStepKeys: string[];
  /** Omit for games with no difficulty presets (Kok Boru). */
  difficultyOptions?: GameDetailDifficulty[];
  difficulty?: GameDetailDifficulty;
  onChangeDifficulty?: (difficulty: GameDetailDifficulty) => void;
  /** Omit for games with no single higher-is-better score (Kyz Kuumai, Kok
   * Boru - see their `*Game.tsx` comments on why that metric doesn't fit). */
  showBestScore?: boolean;
  cultureRoute: string;
  onPressPractice: () => void;
  onPressPlay: () => void;
};

/** Pre-entry screen for every 3D game (Section: "Games should feel like one
 * product, not five demos") - what is this / how to play / difficulty /
 * best score / games played / achievements / a link into Culture, all
 * before the player is dropped into the 3D scene itself. Each game's own
 * route file gates on this the same way `besh-tash.tsx` already gates on
 * `GameIntroScreen` - see docs/3D_GAMES.md. */
export function GameDetailScreen({
  gameId,
  title,
  description,
  objective,
  tutorialStepKeys,
  difficultyOptions,
  difficulty = 'normal',
  onChangeDifficulty,
  showBestScore = false,
  cultureRoute,
  onPressPractice,
  onPressPlay,
}: GameDetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const gamesPlayed = useProgressStore((state) => state.gameStats[gameId]?.played ?? 0);
  const unlockedCount = useProgressStore((state) => state.unlockedAchievementIds.length);
  const [bestScore, setBestScore] = useState<number | null>(null);

  useEffect(() => {
    if (!showBestScore) return;
    let cancelled = false;
    getBestScore(gameId).then((score) => {
      if (!cancelled) setBestScore(score);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, showBestScore]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          icon={ChevronLeft}
          shape="roundedSquare"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
        />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('gameDetail.whatIsThis')}</Text>
          <Text style={styles.body}>{description}</Text>
          <View style={styles.objectiveRow}>
            <Text style={styles.objectiveLabel}>{t('games3d.about.objectiveLabel')}</Text>
            <Text style={styles.objectiveText}>{objective}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('gameDetail.howToPlay')}</Text>
          {tutorialStepKeys.map((key, index) => (
            <View key={key} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.body}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {difficultyOptions ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('gameDetail.difficulty')}</Text>
            <View style={styles.difficultyRow}>
              {difficultyOptions.map((option) => {
                const selected = option === difficulty;
                return (
                  <AnimatedPressable
                    key={option}
                    style={[styles.difficultyPill, selected && styles.difficultyPillSelected]}
                    onPress={() => onChangeDifficulty?.(option)}
                    accessibilityRole="button"
                    accessibilityLabel={t(`gameDetail.${option}`)}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.difficultyLabel, selected && styles.difficultyLabelSelected]}>
                      {t(`gameDetail.${option}`)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          {showBestScore ? (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{bestScore ?? '—'}</Text>
              <Text style={styles.statLabel}>{t('gameDetail.bestScore')}</Text>
            </View>
          ) : null}
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{gamesPlayed}</Text>
            <Text style={styles.statLabel}>{t('gameDetail.gamesPlayed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{t('profile.achievements.unlocked', { unlocked: unlockedCount, total: achievementDefinitions.length })}</Text>
            <Text style={styles.statLabel}>{t('profile.achievements.title')}</Text>
          </View>
        </View>

        <AnimatedPressable
          style={styles.cultureLink}
          onPress={() => router.push(cultureRoute as never)}
          accessibilityRole="button"
          accessibilityLabel={t('gameDetail.learnTradition')}
        >
          <Text style={styles.cultureLinkText}>{t('gameDetail.learnTradition')}</Text>
          <ChevronRight size={18} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.footerButton}>
          <Button label={t('gameDetail.practice')} variant="secondary" onPress={onPressPractice} />
        </View>
        <View style={styles.footerButton}>
          <Button label={t('games.play')} onPress={onPressPlay} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.accentGold,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  objectiveRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: 2,
  },
  objectiveLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  objectiveText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.bodyBold,
    color: colors.primary,
    width: 20,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  difficultyPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  difficultyPillSelected: {
    backgroundColor: colors.primary,
  },
  difficultyLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  difficultyLabelSelected: {
    color: colors.textOnPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 2,
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cultureLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  cultureLinkText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
  footerButton: {
    flex: 1,
  },
});
