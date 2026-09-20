import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Lock, Play } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { GRADIENT_BY_ARTWORK_PROMINENCE } from '@/services/ageExperience/cardGradient';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { gameTitleKey, type GameListItem } from '../types';

/** Same card, same route, same data for every age (spec "adapt
 * presentation/explanation, not cultural identity... preserve gameplay/
 * routing") - only card width/aspect ratio, typography, gradient
 * treatment, meta verbosity, and how obvious the Play affordance is
 * change, driven by AgeExperienceConfig.cardScale/artworkProminence/
 * textComplexity via the shared resolveByCardScale scale.
 *
 * Card width also controls how many are visible per row - large (child)
 * is one per row ("fewer items visible at once, bigger"), dense (adult)
 * is three ("calmer and denser layout"). */
const WIDTH_BY_CARD_SCALE = { large: '100%', medium: '47%', compact: '47%', dense: '31%' } as const;
const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.35, medium: 0.92, compact: 0.98, dense: 1.05 };
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 21, medium: 16, compact: 15, dense: 13 };
const FALLBACK_ICON_SIZE_BY_CARD_SCALE = { large: 44, medium: 32, compact: 28, dense: 24 };

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
  const showFullMeta = config.cardScale !== 'large' && config.cardScale !== 'dense';
  const isLargeCard = config.cardScale === 'large';
  const gradient = GRADIENT_BY_ARTWORK_PROMINENCE[config.artworkProminence];

  return (
    <FadeSlideIn style={{ width: resolveByCardScale(config.cardScale, WIDTH_BY_CARD_SCALE) }} index={index}>
      <AnimatedPressable
        style={[
          styles.card,
          { aspectRatio: resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE) },
          !isPlayable && styles.cardLocked,
        ]}
        onPress={isPlayable ? () => onPress?.(game) : undefined}
        pressScale={0.98}
        disabled={!isPlayable}
        hoverEffect
        haptic={isPlayable ? 'light' : false}
        accessibilityRole="button"
        accessibilityLabel={t(gameTitleKey(game.id))}
        accessibilityState={{ disabled: !isPlayable }}
      >
        {game.thumbnail ? (
          <Image source={game.thumbnail} style={[styles.artwork, !isPlayable && styles.imageLocked]} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.imageFallback]}>
            <Gamepad2
              size={resolveByCardScale(config.cardScale, FALLBACK_ICON_SIZE_BY_CARD_SCALE)}
              color={colors.accentGold}
              strokeWidth={1.5}
            />
          </View>
        )}
        <LinearGradient colors={gradient.colors} locations={gradient.locations} style={StyleSheet.absoluteFill} />

        {!isPlayable ? (
          <View style={styles.lockBadge}>
            <Lock size={13} color={colors.textOnDark} strokeWidth={2.25} />
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.name, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}
              numberOfLines={1}
            >
              {t(gameTitleKey(game.id))}
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
              {showFullMeta
                ? ` · ${t('games.duration.range', { min: game.duration.minMinutes, max: game.duration.maxMinutes })} · ${playersLabel(t, game.players)}`
                : ''}
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
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
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
