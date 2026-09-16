import { Gamepad2, Lock, Play } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import type { GameListItem } from '../types';

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

/** EDITORIAL-tier card (Section "GAME CARD: strong cover artwork, clear
 * Play/status action, minimal metadata") for the regular Games grid - the
 * 3D showcase row uses its own `Game3DShowcaseCard` instead. Artwork is
 * never covered by a dark info bar; title and one metadata line sit below
 * the image in plain text, and playable-vs-coming-soon is a single small
 * corner badge instead of a banner. */
export function GameCard({ game, onPress, index = 0 }: GameCardProps) {
  const { t } = useTranslation();
  const isPlayable = !!game.route;
  const playedCount = useProgressStore((state) => state.gameStats[game.id]?.played);

  return (
    <FadeSlideIn style={styles.wrap} index={index}>
      <AnimatedPressable
        style={[styles.card, !isPlayable && styles.cardDisabled]}
        onPress={isPlayable ? () => onPress?.(game) : undefined}
        disabled={!isPlayable}
        hoverEffect
        haptic={isPlayable ? 'light' : false}
        accessibilityRole="button"
        accessibilityLabel={game.name}
        accessibilityState={{ disabled: !isPlayable }}
      >
        <View style={styles.imageWrap}>
          {game.thumbnail ? (
            <Image source={game.thumbnail} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <Gamepad2 size={28} color={colors.primary} strokeWidth={1.5} />
            </View>
          )}
          <View style={[styles.statusBadge, isPlayable ? styles.statusBadgePlay : styles.statusBadgeLocked]}>
            {isPlayable ? (
              <Play size={12} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
            ) : (
              <Lock size={12} color={colors.textOnDark} strokeWidth={2.25} />
            )}
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.name} numberOfLines={2}>
            {game.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {playersLabel(t, game.players)} · {t('games.duration.range', { min: game.duration.minMinutes, max: game.duration.maxMinutes })}
          </Text>
          {isPlayable && typeof playedCount === 'number' && playedCount > 0 ? (
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
    gap: spacing.xs,
  },
  cardDisabled: {
    opacity: 0.65,
  },
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgePlay: {
    backgroundColor: colors.accentGold,
  },
  statusBadgeLocked: {
    backgroundColor: 'rgba(43,32,25,0.55)',
  },
  textBlock: {
    gap: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
  },
  playedText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
