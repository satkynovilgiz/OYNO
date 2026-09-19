import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Gamepad2, Heart, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn, TextButton } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';

import type { FavoriteGame } from '../types';

type FavoriteGamesCardProps = {
  games: FavoriteGame[];
  onPressSeeAll?: () => void;
  onPressGame?: (game: FavoriteGame) => void;
};

// Wider/shorter for child (matches GameCard's own "large" tier so a
// favorite reads as the same object as the one in the main Games grid,
// just in a horizontal row), narrower and denser toward adult.
const CARD_WIDTH_BY_CARD_SCALE = { large: 190, medium: 152, compact: 138, dense: 126 };
const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.3, medium: 0.95, compact: 0.98, dense: 1.05 };

/** Artwork-first horizontal collection (spec "Task... Favorite Games...
 * artwork should dominate... behave like a compact collection"), same
 * pattern the carousel-clipping fix established elsewhere this session:
 * plain smooth scrolling (no snapToInterval - see DiscoveriesRow/
 * GamesCarousel's own history of that exact bug), a real leading/trailing
 * gutter via contentContainerStyle padding, fixed per-age card width
 * instead of a flex row so extra favorites scroll instead of shrinking. */
export function FavoriteGamesCard({ games, onPressSeeAll, onPressGame }: FavoriteGamesCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const cardWidth = resolveByCardScale(config.cardScale, CARD_WIDTH_BY_CARD_SCALE);
  const aspectRatio = resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {t('profile.favoriteGames.title')}
        </Text>
        {games.length > 0 ? (
          <TextButton
            label={t('common.seeAll')}
            onPress={onPressSeeAll}
            trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
          />
        ) : null}
      </View>

      {games.length === 0 ? (
        <View style={styles.emptyRow}>
          <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
          <Text style={styles.emptyText} numberOfLines={2}>
            {t('profile.favoriteGames.empty')}
          </Text>
          <TextButton label={t('profile.favoriteGames.emptyCta')} onPress={onPressSeeAll} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {games.map((game, index) => (
            <FadeSlideIn key={game.id} index={index}>
              <AnimatedPressable
                style={[styles.card, { width: cardWidth, aspectRatio }]}
                onPress={() => onPressGame?.(game)}
                pressScale={0.98}
                hoverEffect
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={game.name}
              >
                {game.thumbnail ? (
                  <Image source={game.thumbnail} style={styles.artwork} resizeMode="cover" />
                ) : (
                  <View style={[styles.artwork, styles.artworkFallback]}>
                    <Gamepad2 size={28} color={colors.accentGold} strokeWidth={1.5} />
                  </View>
                )}
                <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.85)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

                <View style={styles.overlay} pointerEvents="box-none">
                  <View style={styles.favoriteBadge}>
                    <Heart size={11} color={colors.accentGold} fill={colors.accentGold} strokeWidth={0} />
                  </View>

                  <View>
                    <Text style={styles.gameName} numberOfLines={1}>
                      {game.name}
                    </Text>
                    <View style={styles.winsRow}>
                      <Trophy size={10} color={colors.accentGold} strokeWidth={2.25} />
                      <Text style={styles.gameMeta} numberOfLines={1}>
                        {t('profile.favoriteGames.wins', { count: game.wins })}
                      </Text>
                    </View>
                  </View>
                </View>
              </AnimatedPressable>
            </FadeSlideIn>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  list: {
    gap: spacing.sm,
  },
  // Owns sizing/overflow only - no padding here. Padding for the
  // title/status/heart lives on `overlay` instead - see
  // TodayDiscoveryCard's `card`/`overlay` comment for why padding
  // directly on this node would make the absolute-fill artwork fall
  // short of the true edge.
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  artworkFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.xs,
  },
  favoriteBadge: {
    alignSelf: 'flex-end',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(19,32,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameName: {
    ...typography.body,
    color: colors.textOnDark,
    fontWeight: '700',
  },
  gameMeta: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  winsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
});
