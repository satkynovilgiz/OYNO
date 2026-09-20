import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { gameTitleKey, type GameListItem } from '../types';

type Game3DShowcaseCardProps = {
  game: GameListItem;
  onPress?: (game: GameListItem) => void;
  index?: number;
};

/** Large cinematic card for the "Play in 3D" showcase (Section "large
 * visual featured section... horizontally scrollable 'Play in 3D'
 * showcase with large cinematic cards") - a distinct hero-tier treatment
 * from the regular Games grid, not GameCard reused at a bigger size. Only
 * the game name and a single Play affordance sit over the artwork; every
 * other stat lives one tap away on GameDetailScreen instead of crowding
 * the card. */
export function Game3DShowcaseCard({ game, onPress, index = 0 }: Game3DShowcaseCardProps) {
  const { t } = useTranslation();
  const playedCount = useProgressStore((state) => state.gameStats[game.id]?.played);

  return (
    <FadeSlideIn style={styles.wrap} index={index}>
      <AnimatedPressable
        style={styles.card}
        onPress={() => onPress?.(game)}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={t(gameTitleKey(game.id))}
      >
        {game.thumbnail ? (
          <Image source={game.thumbnail} style={styles.artwork} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.fallback]}>
            <Gamepad2 size={40} color={colors.accentGold} strokeWidth={1.5} />
          </View>
        )}
        <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.badge3D}>
          <Text style={styles.badge3DText}>3D</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {t(gameTitleKey(game.id))}
          </Text>
          <View style={styles.ctaRow}>
            <View style={styles.playPill}>
              <Play size={11} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
              <Text style={styles.playPillText}>{t('games.play')}</Text>
            </View>
            {typeof playedCount === 'number' && playedCount > 0 ? (
              <Text style={styles.playedText}>{t('games.playedCount', { count: playedCount })}</Text>
            ) : null}
          </View>
        </View>
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 240,
  },
  card: {
    width: '100%',
    aspectRatio: 1.05,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceFeature,
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceFeature,
  },
  badge3D: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.accentGold,
  },
  badge3DText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    ...typography.h1,
    fontSize: 20,
    color: colors.textOnDark,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  playPillText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  playedText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
});
