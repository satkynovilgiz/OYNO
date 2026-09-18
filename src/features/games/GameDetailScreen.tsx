import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Gamepad2, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterAvatar } from '@/components/character';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn, IconButton } from '@/components/ui';
import { getBestScore } from '@/games3d/core/gameBestScore';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { achievementDefinitions } from '@/services/progress/achievements';
import { useProgressStore } from '@/store/useProgressStore';
import { aspectRatios, colors, radii, shadows, spacing, typography } from '@/theme';
import { getGameHostConfig } from '@games/gameHostCharacters';

export type GameDetailDifficulty = 'easy' | 'normal' | 'hard';

type GameDetailScreenProps = {
  gameId: string;
  title: string;
  description: string;
  objective: string;
  tutorialStepKeys: string[];
  /** Existing game-card artwork (Games screen's mockData thumbnails) reused
   * here as a header banner - omit only for a game with no art yet (Kok
   * Boru, see docs/DESIGN_ASSET_AUDIT.md), which falls back to a plain
   * icon chip instead of inventing placeholder art. */
  imageSource?: ImageSourcePropType;
  /** Omit for games with no difficulty presets (Kok Boru). */
  difficultyOptions?: GameDetailDifficulty[];
  difficulty?: GameDetailDifficulty;
  onChangeDifficulty?: (difficulty: GameDetailDifficulty) => void;
  /** Omit for games with no single higher-is-better score (Kyz Kuumai, Kok
   * Boru - see their `*Game.tsx` comments on why that metric doesn't fit). */
  showBestScore?: boolean;
  /** id of an already-researched, verified `culture_items` row whose
   * history/cultural_meaning should be surfaced as this game's cultural
   * origin/context (spec "history/traditional significance where
   * verified... never generate cultural facts dynamically at runtime").
   * Omit for a game with no such row yet (Ordo/Chuko/Jaa Atuu today) - the
   * section then simply doesn't render, rather than showing invented text. */
  culturalContextItemId?: string;
  cultureRoute: string;
  onPressPractice: () => void;
  onPressPlay: () => void;
};

/** Pre-entry screen for every 3D game (Section: "Games should feel like one
 * product, not five demos") - what is this / how to play / difficulty /
 * best score / games played / achievements / a link into Culture, all
 * before the player is dropped into the 3D scene itself. Each game's own
 * route file gates on this the same way `besh-tash.tsx` already gates on
 * `GameIntroScreen` - see docs/3D_GAMES.md.
 *
 * Adapts by AgeExperience (spec "GAME DETAIL... finish those areas"):
 * child gets a bigger banner, a short (2-line) description, the game's own
 * guide character next to "How to play", no difficulty picker, and no
 * stats row ("avoid overwhelming statistics"); preteen adds difficulty +
 * full stats + a modest cultural-context note; teen drops the guide
 * character and shows everything at standard density; adult leads with
 * cultural context (when a verified culture_items row exists for this
 * game), shows the complete rule breakdown, and gets a compact footer. */
export function GameDetailScreen({
  gameId,
  title,
  description,
  objective,
  tutorialStepKeys,
  imageSource,
  difficultyOptions,
  difficulty = 'normal',
  onChangeDifficulty,
  showBestScore = false,
  culturalContextItemId,
  cultureRoute,
  onPressPractice,
  onPressPlay,
}: GameDetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { config } = useAgeExperience();
  const gamesPlayed = useProgressStore((state) => state.gameStats[gameId]?.played ?? 0);
  const unlockedCount = useProgressStore((state) => state.unlockedAchievementIds.length);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const { data: culturalContextItem } = useCultureItem(culturalContextItemId ?? '');

  const isChild = config.textComplexity === 'minimal';
  const showCharacterGuidance = config.characterProminence === 'primary' || config.characterProminence === 'frequent';
  const showDifficultyPicker = !isChild && !!difficultyOptions;
  const showStatsRow = !isChild;
  const showCulturalContext = !!culturalContextItem && (culturalContextItem.cultural_meaning || culturalContextItem.history);
  const isAdult = config.characterProminence === 'subtle';
  const host = getGameHostConfig(gameId);
  const bannerAspectRatio = resolveByCardScale(config.cardScale, { large: 1.5, medium: aspectRatios.banner, compact: 2.1, dense: 2.4 });

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
        <View style={[styles.banner, { aspectRatio: bannerAspectRatio }]}>
          {imageSource ? (
            <Image source={imageSource} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.bannerFallback}>
              <Gamepad2 size={32} color={colors.primary} strokeWidth={1.75} />
            </View>
          )}
        </View>

        {isAdult && showCulturalContext ? (
          <FadeSlideIn style={[styles.card, styles.culturalContextCardProminent]} index={0}>
            <Text style={styles.sectionLabel}>{t('gameDetail.culturalContext')}</Text>
            <Text style={styles.body}>{culturalContextItem!.history ?? culturalContextItem!.cultural_meaning}</Text>
            {culturalContextItem!.history && culturalContextItem!.cultural_meaning ? (
              <Text style={styles.body}>{culturalContextItem!.cultural_meaning}</Text>
            ) : null}
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn style={styles.card} index={1}>
          <Text style={styles.sectionLabel}>{t('gameDetail.whatIsThis')}</Text>
          <Text style={styles.body} numberOfLines={isChild ? 2 : undefined}>
            {description}
          </Text>
          <View style={styles.objectiveRow}>
            <Text style={styles.objectiveLabel}>{t('games3d.about.objectiveLabel')}</Text>
            <Text style={styles.objectiveText}>{objective}</Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn style={styles.card} index={2}>
          <View style={styles.howToPlayHeader}>
            <Text style={styles.sectionLabel}>{t('gameDetail.howToPlay')}</Text>
            {showCharacterGuidance && host ? (
              <CharacterAvatar characterId={host.characterId} emotion="happy" size={32} />
            ) : null}
          </View>
          {tutorialStepKeys.map((key, index) => (
            <View key={key} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.body}>{t(key)}</Text>
            </View>
          ))}
        </FadeSlideIn>

        {!isAdult && showCulturalContext ? (
          <FadeSlideIn style={styles.card} index={3}>
            <Text style={styles.sectionLabel}>{t('gameDetail.culturalContext')}</Text>
            <Text style={styles.body} numberOfLines={3}>
              {culturalContextItem!.cultural_meaning ?? culturalContextItem!.history}
            </Text>
          </FadeSlideIn>
        ) : null}

        {showDifficultyPicker ? (
          <FadeSlideIn style={styles.card} index={4}>
            <Text style={styles.sectionLabel}>{t('gameDetail.difficulty')}</Text>
            <View style={styles.difficultyRow}>
              {difficultyOptions!.map((option) => {
                const selected = option === difficulty;
                return (
                  <AnimatedPressable
                    key={option}
                    style={[styles.difficultyPill, selected && styles.difficultyPillSelected]}
                    onPress={() => onChangeDifficulty?.(option)}
                    haptic="light"
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
          </FadeSlideIn>
        ) : null}

        {showStatsRow ? (
          <FadeSlideIn style={styles.statsRow} index={5}>
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
          </FadeSlideIn>
        ) : null}

        <AnimatedPressable
          style={styles.cultureLink}
          onPress={() => router.push(cultureRoute as never)}
          hoverEffect
          accessibilityRole="button"
          accessibilityLabel={t('gameDetail.learnTradition')}
        >
          <OymoOrnament size={12} color={colors.accentGold} />
          <Text style={styles.cultureLinkText}>{t('gameDetail.learnTradition')}</Text>
          <ChevronRight size={18} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </ScrollView>

      <View style={[styles.footer, isAdult && styles.footerCompact, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={[styles.footerButton, isChild && styles.footerButtonSecondary]}>
          <Button label={t('gameDetail.practice')} variant="secondary" onPress={onPressPractice} />
        </View>
        <View style={[styles.footerButton, isChild && styles.footerButtonPrimary]}>
          <Button
            label={t('games.play')}
            onPress={onPressPlay}
            icon={isChild ? <Play size={16} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} /> : undefined}
          />
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
  banner: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  culturalContextCardProminent: {
    borderColor: colors.accentGold,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceWarm,
  },
  howToPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  footerCompact: {
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  footerButton: {
    flex: 1,
  },
  // Child gets an "obvious Play button" (spec) - Play takes twice the
  // width of Practice instead of an even 50/50 split.
  footerButtonSecondary: {
    flex: 1,
  },
  footerButtonPrimary: {
    flex: 2,
  },
});
