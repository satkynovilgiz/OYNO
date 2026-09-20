import { ChevronRight, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, FadeSlideIn, TextButton } from '@/components/ui';
import { gameTitleKey, type GameListItem } from '@/features/games/types';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type GamesCarouselProps = {
  games: GameListItem[];
  onPressGame?: (game: GameListItem) => void;
  onPressSeeAll?: () => void;
};

const PAGE_DOT_COUNT = 4;

/** "Continue Playing" tiles - a big, unmissable Play affordance for child
 * (spec "big Continue Playing... clearer Play/Continue CTAs"), shrinking
 * to a compact icon-only badge by teen/adult (spec "smaller, more refined
 * controls"). */
const THUMBNAIL_SIZE_BY_CARD_SCALE = { large: 148, medium: 104, compact: 92, dense: 80 };
const NAME_FONT_SIZE_BY_CARD_SCALE = { large: 15, medium: 11, compact: 11, dense: 10 };
const PLAY_BADGE_SIZE_BY_CARD_SCALE = { large: 40, medium: 28, compact: 24, dense: 22 };

export function GamesCarousel({ games, onPressGame, onPressSeeAll }: GamesCarouselProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const thumbnailSize = resolveByCardScale(config.cardScale, THUMBNAIL_SIZE_BY_CARD_SCALE);
  const showPlayLabel = config.cardScale === 'large';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('home.games.sectionTitle')}</Text>
        <TextButton
          label={t('common.seeAll')}
          onPress={onPressSeeAll}
          trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {games.map((game, index) => (
          <FadeSlideIn key={game.id} index={index}>
            <AnimatedPressable
              style={[styles.card, { width: thumbnailSize }]}
              onPress={() => onPressGame?.(game)}
              hoverEffect
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t(gameTitleKey(game.id))}
            >
              <View>
                <Image
                  source={game.thumbnail}
                  style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }]}
                  resizeMode="cover"
                />
                <View
                  style={[
                    styles.playBadge,
                    {
                      width: showPlayLabel ? undefined : resolveByCardScale(config.cardScale, PLAY_BADGE_SIZE_BY_CARD_SCALE),
                      height: resolveByCardScale(config.cardScale, PLAY_BADGE_SIZE_BY_CARD_SCALE),
                      borderRadius: resolveByCardScale(config.cardScale, PLAY_BADGE_SIZE_BY_CARD_SCALE) / 2,
                      paddingHorizontal: showPlayLabel ? spacing.sm : 0,
                    },
                  ]}
                >
                  <Play size={showPlayLabel ? 14 : 12} color={colors.textPrimary} fill={colors.textPrimary} strokeWidth={0} />
                  {showPlayLabel ? <Text style={styles.playBadgeLabel}>{t('games.play')}</Text> : null}
                </View>
              </View>
              <Text
                style={[styles.name, { fontSize: resolveByCardScale(config.cardScale, NAME_FONT_SIZE_BY_CARD_SCALE) }]}
                numberOfLines={1}
              >
                {t(gameTitleKey(game.id))}
              </Text>
            </AnimatedPressable>
          </FadeSlideIn>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {Array.from({ length: PAGE_DOT_COUNT }).map((_, index) => (
          <View key={index} style={[styles.dot, index === 0 && styles.dotActive]} />
        ))}
      </View>
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
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  thumbnail: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  playBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.background,
  },
  playBadgeLabel: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  name: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceBorder,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
