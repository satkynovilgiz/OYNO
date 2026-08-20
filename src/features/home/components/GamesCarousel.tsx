import { ChevronRight, Dices } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { GameSummary } from '../types';

type GamesCarouselProps = {
  games: GameSummary[];
  onPressGame?: (game: GameSummary) => void;
  onPressSeeAll?: () => void;
};

const PAGE_DOT_COUNT = 4;

export function GamesCarousel({ games, onPressGame, onPressSeeAll }: GamesCarouselProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('home.games.sectionTitle')}</Text>
        <AnimatedPressable style={styles.seeAll} onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {games.map((game) => (
          <AnimatedPressable
            key={game.id}
            style={styles.card}
            onPress={() => onPressGame?.(game)}
            accessibilityRole="button"
            accessibilityLabel={game.name}
          >
            <View style={styles.thumbnail}>
              <Dices size={26} color={colors.accentBrown} strokeWidth={1.75} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {game.name}
            </Text>
          </AnimatedPressable>
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
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 92,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  thumbnail: {
    width: 92,
    height: 92,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
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
