import { ChevronRight, Gamepad2, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, EmptyState, FadeSlideIn, TextButton } from '@/components/ui';
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
        <EmptyState
          compact
          icon={Gamepad2}
          title={t('profile.favoriteGames.empty')}
          description={t('profile.favoriteGames.emptyDescription')}
        />
      ) : (
        <View style={styles.list}>
          {games.map((game, index) => (
            <FadeSlideIn key={game.id} style={styles.gameItem} index={index}>
              <AnimatedPressable
                style={styles.gamePressable}
                onPress={() => onPressGame?.(game)}
                hoverEffect
                accessibilityRole="button"
                accessibilityLabel={game.name}
              >
                {game.thumbnail ? (
                  <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                    <Gamepad2 size={24} color={colors.primary} strokeWidth={1.75} />
                  </View>
                )}
                <Text style={styles.gameName} numberOfLines={1}>
                  {game.name}
                </Text>
                <View style={styles.winsRow}>
                  <Trophy size={11} color={colors.accentGold} strokeWidth={2.25} />
                  <Text style={styles.gameMeta}>{t('profile.favoriteGames.wins', { count: game.wins })}</Text>
                  <Text style={styles.gameMeta}>· {t('profile.favoriteGames.played', { count: game.gamesPlayed })}</Text>
                </View>
              </AnimatedPressable>
            </FadeSlideIn>
          ))}
        </View>
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
  list: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gameItem: {
    flex: 1,
  },
  gamePressable: {
    gap: spacing.xxs,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    ...shadows.card,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameName: {
    ...typography.body,
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
    gap: 3,
  },
});
