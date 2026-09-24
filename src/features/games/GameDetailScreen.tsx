import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Gamepad2, Heart, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterAvatar } from '@/components/character';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, FadeSlideIn, HeroEntrance, IconButton } from '@/components/ui';
import { getBestScore } from '@/games3d/core/gameBestScore';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { useHeroParallax } from '@/services/motion/useHeroParallax';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, shadows, spacing, typography } from '@/theme';
import { getGameHostConfig } from '@games/gameHostCharacters';

import { gameArt, listGameForProgressId } from './gamesCatalog';

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
  isFavorite: boolean;
  onToggleFavorite: () => void;
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
  isFavorite,
  onToggleFavorite,
  onPressPractice,
  onPressPlay,
}: GameDetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { config } = useAgeExperience();
  const gamesPlayed = useProgressStore((state) => state.gameStats[gameId]?.played ?? 0);
  const gamesWon = useProgressStore((state) => state.gameStats[gameId]?.won ?? 0);
  const { scrollHandler, heroStyle } = useHeroParallax();
  // The same catalog entry the Games tab shows: sharper large-format art
  // where it exists, plus real players/duration/difficulty facts.
  const listGame = listGameForProgressId(gameId);
  const heroArt = (listGame ? gameArt(listGame, 'large') : null) ?? imageSource ?? null;
  const [bestScore, setBestScore] = useState<number | null>(null);
  const { data: culturalContextItem } = useCultureItem(culturalContextItemId ?? '');

  const isChild = config.textComplexity === 'minimal';
  const showCharacterGuidance = config.characterProminence === 'primary' || config.characterProminence === 'frequent';
  const showDifficultyPicker = !isChild && !!difficultyOptions;
  const showStatsRow = !isChild;
  const showCulturalContext = !!culturalContextItem && (culturalContextItem.cultural_meaning || culturalContextItem.history);
  const isAdult = config.characterProminence === 'subtle';
  const host = getGameHostConfig(gameId);
  // Cinematic, taller than the old banner; a little calmer for adults.
  const bannerAspectRatio = resolveByCardScale(config.cardScale, { large: 0.95, medium: 1.05, compact: 1.15, dense: 1.3 });
  const facts = listGame && !isChild
    ? [
        listGame.players.kind === 'team'
          ? t('games.players.team')
          : listGame.players.kind === 'exact'
            ? t('games.players.exact', { count: listGame.players.count })
            : t('games.players.open', { min: listGame.players.min }),
        t('games.duration.range', { min: listGame.duration.minMinutes, max: listGame.duration.maxMinutes }),
        t(`games.difficulty.${listGame.difficulty}`),
      ]
    : [];

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
      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeroEntrance>
          <View style={[styles.hero, { aspectRatio: bannerAspectRatio }]}>
            <Animated.View style={[styles.heroImage, heroStyle]}>
              {heroArt ? (
                <Image source={heroArt} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.heroImage, styles.heroFallback]}>
                  <OymoOrnament size={120} color="rgba(232,185,61,0.3)" strokeWidth={1.25} />
                  <Gamepad2 size={40} color={colors.accentGold} strokeWidth={1.5} style={styles.heroFallbackIcon} />
                </View>
              )}
            </Animated.View>
            <LinearGradient colors={['rgba(19,32,24,0.45)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.92)']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />

            <View style={styles.heroOverlay} pointerEvents="box-none">
              <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.sm }]}>
                <IconButton
                  icon={ChevronLeft}
                  shape="roundedSquare"
                  variant="surface"
                  accessibilityLabel={t('common.back')}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
                />
                <IconButton
                  icon={Heart}
                  shape="roundedSquare"
                  variant={isFavorite ? 'primary' : 'surface'}
                  accessibilityLabel={isFavorite ? t('saved.removeLabel') : t('saved.saveLabel')}
                  onPress={onToggleFavorite}
                />
              </View>
              <View style={styles.heroText}>
                {listGame ? <Text style={styles.heroEyebrow}>{t(`games.categories.${listGame.category}`)}</Text> : null}
                <Text style={[styles.heroTitle, isAdult && styles.heroTitleEditorial]} numberOfLines={2} accessibilityRole="header">
                  {title}
                </Text>
                {gamesPlayed > 0 ? (
                  <Text style={styles.heroStats}>
                    {gamesWon > 0 ? t('games.playAgain.statsWithWins', { played: gamesPlayed, won: gamesWon }) : t('games.playAgain.stats', { played: gamesPlayed })}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </HeroEntrance>

        {facts.length > 0 ? (
          <View style={styles.factsRow} accessible accessibilityLabel={facts.join(', ')}>
            {facts.map((fact) => (
              <View key={fact} style={styles.fact}>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isAdult && showCulturalContext ? (
          <FadeSlideIn style={[styles.card, styles.culturalContextCardProminent]} index={0}>
            <Text style={styles.sectionLabel}>{t('gameDetail.culturalContext')}</Text>
            <Text style={styles.body}>{culturalContextItem!.history ?? culturalContextItem!.cultural_meaning}</Text>
            {culturalContextItem!.history && culturalContextItem!.cultural_meaning ? (
              <Text style={styles.body}>{culturalContextItem!.cultural_meaning}</Text>
            ) : null}
          </FadeSlideIn>
        ) : null}

        {!isAdult && showCulturalContext ? (
          <FadeSlideIn style={styles.card} index={3}>
            <Text style={styles.sectionLabel}>{t('gameDetail.culturalContext')}</Text>
            <Text style={styles.body} numberOfLines={3}>
              {culturalContextItem!.cultural_meaning ?? culturalContextItem!.history}
            </Text>
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
              <Text style={styles.statValue}>{gamesWon}</Text>
              <Text style={styles.statLabel}>{t('gameDetail.wins')}</Text>
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
      </Animated.ScrollView>

      <View style={[styles.footer, isAdult && styles.footerCompact, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={[styles.footerButton, styles.footerButtonSecondary]}>
          <Button label={t('gameDetail.practice')} variant="secondary" onPress={onPressPractice} />
        </View>
        {/* Play is always the strongest action: twice Practice's width, with icon. */}
        <View style={[styles.footerButton, styles.footerButtonPrimary]}>
          <Button label={t('games.play')} onPress={onPressPlay} icon={<Play size={16} color={colors.textOnPrimary} fill={colors.textOnPrimary} strokeWidth={0} />} />
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
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  // Owns sizing/overflow only - no padding here. Padding for the back
  // button/title lives on `heroOverlay` instead, whose own parent (this
  // node) has none - see TodayDiscoveryCard's `card`/`overlay` comment
  // for why padding directly on this node would make the absolute-fill
  // image/gradient fall short of the true edge.
  hero: {
    width: '100%',
    marginHorizontal: -spacing.md,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroText: {
    gap: 2,
  },
  heroEyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  heroTitle: {
    fontFamily: fontFamily.wordmark,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  heroTitleEditorial: {
    fontSize: 30,
    lineHeight: 36,
  },
  heroStats: {
    ...typography.caption,
    fontWeight: '600',
    color: 'rgba(251,243,227,0.85)',
  },
  heroFallbackIcon: {
    position: 'absolute',
  },
  factsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  fact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  factText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
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
