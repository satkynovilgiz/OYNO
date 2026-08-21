import { ChevronRight, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { FavoriteGame } from '../types';

type FavoriteGamesCardProps = {
  games: FavoriteGame[];
  onPressSeeAll?: () => void;
  onPressGame?: (game: FavoriteGame) => void;
};

export function FavoriteGamesCard({ games, onPressSeeAll, onPressGame }: FavoriteGamesCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.favoriteGames.title')}</Text>
        <AnimatedPressable style={styles.seeAll} onPress={onPressSeeAll} accessibilityRole="button">
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <View style={styles.list}>
        {games.map((game) => (
          <AnimatedPressable
            key={game.id}
            style={styles.gameItem}
            onPress={() => onPressGame?.(game)}
            accessibilityRole="button"
            accessibilityLabel={game.name}
          >
            <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
            <Text style={styles.gameName} numberOfLines={1}>
              {game.name}
            </Text>
            <Text style={styles.gameMeta}>{t('profile.favoriteGames.played', { count: game.gamesPlayed })}</Text>
            <View style={styles.winsRow}>
              <Trophy size={11} color={colors.accentGold} strokeWidth={2.25} />
              <Text style={styles.gameMeta}>{t('profile.favoriteGames.wins', { count: game.wins })}</Text>
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xs,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  seeAll: {
    padding: 2,
  },
  list: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  gameItem: {
    flex: 1,
    gap: 2,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  gameName: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  gameMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  winsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
