import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Lock, Play } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import type { GameListItem } from '../types';

/** Same card, same route, same data for every age (spec "adapt
 * presentation/explanation, not cultural identity... preserve gameplay/
 * routing") - only aspect ratio, meta verbosity, and how obvious the Play
 * affordance is change, driven by AgeExperienceConfig.cardScale/
 * textComplexity. */
const ASPECT_RATIO_BY_CARD_SCALE: Record<'large' | 'medium' | 'compact', number> = {
  large: 0.8,
  medium: 0.92,
  compact: 1.02,
};

type GameCardProps = {
  game: GameListItem;
  onPress?: (game: GameListItem) => void;
  /** Staggers this card's entrance animation (Section "subtle card
   * entrance... animations") - an index within its own row/section, not a
   * global one, so each section cascades in independently. */
  index?: number;
};

function playersLabel(t: (key: string, options?: Record<string, unknown>) => string, players: GameListItem['players']): string {
  if (players.kind === 'team') return t('games.players.team');
  if (players.kind === 'exact') return t('games.players.exact', { count: players.count });
  return t('games.players.open', { min: players.min });
}

/** One complete visual object (Section "GAME CARD... make each card one
 * complete visual object") - the artwork IS the card, with title/metadata
 * and the play/lock state living directly on it behind a bottom gradient,
 * instead of a separate image tile plus a floating badge plus a text block
 * underneath. The 3D showcase row uses its own `Game3DShowcaseCard`. */
export function GameCard({ game, onPress, index = 0 }: GameCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const isPlayable = !!game.route;
  const playedCount = useProgressStore((state) => state.gameStats[game.id]?.played);

  // child: minimal text, one clear affordance. preteen/teen: full meta plus
  // played-count (achievements/scores emphasized). adult: meta stays
  // (duration/players read as cultural/practical context) but the played-
  // count gamification pill drops, per "reduced gamification clutter".
  const showMeta = config.textComplexity !== 'minimal';
  const showPlayedCount = config.textComplexity === 'simple' || config.textComplexity === 'standard';
  const isLargeCard = config.cardScale === 'large';

  return (
    <FadeSlideIn style={styles.wrap} index={index}>
      <AnimatedPressable
        style={[styles.card, { aspectRatio: ASPECT_RATIO_BY_CARD_SCALE[config.cardScale] }, !isPlayable && styles.cardLocked]}
        onPress={isPlayable ? () => onPress?.(game) : undefined}
        pressScale={0.98}
        disabled={!isPlayable}
        hoverEffect
        haptic={isPlayable ? 'light' : false}
        accessibilityRole="button"
        accessibilityLabel={game.name}
        accessibilityState={{ disabled: !isPlayable }}
      >
        {game.thumbnail ? (
          <Image source={game.thumbnail} style={[StyleSheet.absoluteFill, !isPlayable && styles.imageLocked]} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
            <Gamepad2 size={isLargeCard ? 40 : 32} color={colors.accentGold} strokeWidth={1.5} />
          </View>
        )}
        <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.9)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />

        {!isPlayable ? (
          <View style={styles.lockBadge}>
            <Lock size={13} color={colors.textOnDark} strokeWidth={2.25} />
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, isLargeCard && styles.nameLarge]} numberOfLines={1}>
              {game.name}
            </Text>
            {isPlayable ? (
              <View style={[styles.playBadge, isLargeCard && styles.playBadgeLarge]}>
                <Play size={isLargeCard ? 13 : 11} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
                {isLargeCard ? <Text style={styles.playBadgeLabel}>{t('games.play')}</Text> : null}
              </View>
            ) : null}
          </View>
          {showMeta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {t(`games.difficulty.${game.difficulty}`)}
              {!isLargeCard ? ` · ${t('games.duration.range', { min: game.duration.minMinutes, max: game.duration.maxMinutes })} · ${playersLabel(t, game.players)}` : ''}
            </Text>
          ) : null}
          {showPlayedCount && isPlayable && typeof playedCount === 'number' && playedCount > 0 ? (
            <Text style={styles.playedText}>{t('games.playedCount', { count: playedCount })}</Text>
          ) : null}
        </View>
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '47%',
  },
  card: {
    width: '100%',
    aspectRatio: 0.92,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(139,107,61,0.2)',
  },
  cardLocked: {
    borderColor: 'rgba(139,107,61,0.12)',
  },
  imageLocked: {
    opacity: 0.6,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceFeature,
  },
  lockBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(19,32,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.sm,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyBold,
    fontSize: 16,
    flexShrink: 1,
    color: colors.textOnDark,
  },
  nameLarge: {
    fontSize: 19,
  },
  playBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeLarge: {
    flexDirection: 'row',
    width: undefined,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    gap: spacing.xxs,
  },
  playBadgeLabel: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  playedText: {
    ...typography.small,
    color: colors.accentGold,
    fontWeight: '700',
  },
});
