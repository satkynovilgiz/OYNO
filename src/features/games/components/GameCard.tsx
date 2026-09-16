import { LinearGradient } from 'expo-linear-gradient';
import { Award, Clock, Signal, Users } from 'lucide-react-native';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui';
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
  /** `featured` is the wider showcase card used in the 3D-games row
   * (bigger artwork, Section "Give game artwork more visual importance");
   * `grid` (default) is the regular 2-column card. Same component either
   * way - one place to keep the "premium card" look consistent. */
  size?: 'grid' | 'featured';
};

function playersLabel(t: (key: string, options?: Record<string, unknown>) => string, players: GameListItem['players']): string {
  if (players.kind === 'team') return t('games.players.team');
  if (players.kind === 'exact') return t('games.players.exact', { count: players.count });
  return t('games.players.open', { min: players.min });
}

export function GameCard({ game, onPress, index = 0, size = 'grid' }: GameCardProps) {
  const { t } = useTranslation();
  const isPlayable = !!game.route;
  const isFeatured = size === 'featured';
  const playedCount = useProgressStore((state) => state.gameStats[game.id]?.played);

  // Cascading fade/rise-in (Section "subtle card entrance... animations
  // using the project's existing animation system") - reanimated, same
  // idiom as GameIntroCard/StartCountdown elsewhere in the app, staggered
  // by this card's position in its own row so a grid/showcase reveals
  // left-to-right instead of every card popping in at once.
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    const delay = Math.min(index, 8) * 55;
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 260 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[isFeatured ? styles.featuredWrap : styles.gridWrap, enterStyle]}>
      <AnimatedPressable
        style={[styles.card, game.is3D && styles.card3D, !isPlayable && styles.cardDisabled]}
        onPress={isPlayable ? () => onPress?.(game) : undefined}
        disabled={!isPlayable}
        hoverEffect
        haptic={isPlayable ? 'light' : false}
        accessibilityRole="button"
        accessibilityLabel={game.name}
        accessibilityState={{ disabled: !isPlayable }}
      >
        <View style={[styles.thumbnailWrap, isFeatured && styles.thumbnailWrapFeatured]}>
          <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
          <LinearGradient colors={['rgba(20,14,8,0)', 'rgba(20,14,8,0.05)', 'rgba(20,14,8,0.85)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

          {game.featured ? (
            <View style={styles.awardBadge}>
              <Award size={13} color={colors.textOnPrimary} strokeWidth={2} />
            </View>
          ) : null}
          {!isPlayable ? (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>{t('games.comingSoonBadge')}</Text>
            </View>
          ) : null}

          <View style={styles.overlayText}>
            <Text style={styles.category} numberOfLines={1}>
              {t(`games.categories.${game.category}`)}
            </Text>
            <Text style={[styles.name, isFeatured && styles.nameFeatured]} numberOfLines={1}>
              {game.name}
            </Text>
            <View style={styles.metaRow}>
              <Signal size={11} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              <Text style={styles.metaTextLight}>{t(`games.difficulty.${game.difficulty}`)}</Text>
              <View style={styles.metaDotLight} />
              <Clock size={11} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              <Text style={styles.metaTextLight}>
                {t('games.duration.range', { min: game.duration.minMinutes, max: game.duration.maxMinutes })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.playersRow}>
            <Users size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>
              {playersLabel(t, game.players)}
            </Text>
          </View>

          {isPlayable ? (
            typeof playedCount === 'number' && playedCount > 0 ? (
              <View style={styles.playedChip}>
                <Text style={styles.playedChipText}>{t('games.playedCount', { count: playedCount })}</Text>
              </View>
            ) : (
              <View style={styles.playChip}>
                <Text style={styles.playChipText}>{t('games.play')}</Text>
              </View>
            )
          ) : null}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const CARD_BORDER = 'rgba(139,107,61,0.25)';
const CARD_BORDER_3D = 'rgba(232,185,61,0.55)';

const styles = StyleSheet.create({
  gridWrap: {
    width: '47%',
  },
  featuredWrap: {
    width: 210,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  card3D: {
    borderColor: CARD_BORDER_3D,
    borderWidth: 1.5,
  },
  cardDisabled: {
    opacity: 0.75,
  },
  thumbnailWrap: {
    width: '100%',
    aspectRatio: 1.05,
    justifyContent: 'flex-end',
  },
  thumbnailWrapFeatured: {
    aspectRatio: 1.3,
  },
  thumbnail: {
    ...StyleSheet.absoluteFill,
  },
  awardBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(43,32,25,0.75)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  comingSoonText: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
  },
  overlayText: {
    padding: spacing.sm,
    gap: 2,
  },
  category: {
    ...typography.overline,
    fontSize: 9,
    color: colors.accentGold,
  },
  name: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textOnDark,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  nameFeatured: {
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaDotLight: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  metaTextLight: {
    ...typography.small,
    color: 'rgba(255,255,255,0.85)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flexShrink: 1,
  },
  metaText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  playChip: {
    backgroundColor: colors.accentGold,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  playChipText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  playedChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  playedChipText: {
    ...typography.small,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
