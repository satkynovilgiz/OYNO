import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, TextButton } from '@/components/ui';
import type { GameListItem } from '@/features/games/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type GamesCarouselProps = {
  games: GameListItem[];
  onPressGame?: (game: GameListItem) => void;
  onPressSeeAll?: () => void;
};

const PAGE_DOT_COUNT = 4;

export function GamesCarousel({ games, onPressGame, onPressSeeAll }: GamesCarouselProps) {
  const { t } = useTranslation();

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
        {games.map((game) => (
          <AnimatedPressable
            key={game.id}
            style={styles.card}
            onPress={() => onPressGame?.(game)}
            accessibilityRole="button"
            accessibilityLabel={game.name}
          >
            <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
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
