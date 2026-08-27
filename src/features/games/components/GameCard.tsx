import { Award, Clock, Signal, Users } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { GameListItem } from '../types';

type GameCardProps = {
  game: GameListItem;
  onPress?: (game: GameListItem) => void;
};

function playersLabel(t: (key: string, options?: Record<string, unknown>) => string, players: GameListItem['players']): string {
  if (players.kind === 'team') return t('games.players.team');
  if (players.kind === 'exact') return t('games.players.exact', { count: players.count });
  return t('games.players.open', { min: players.min });
}

export function GameCard({ game, onPress }: GameCardProps) {
  const { t } = useTranslation();
  const isPlayable = !!game.route;

  return (
    <View style={styles.pressable}>
      <Card padded={false} style={[styles.card, !isPlayable && styles.cardDisabled]}>
        <View style={styles.thumbnailWrap}>
          <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
          {game.featured ? (
            <View style={styles.badge}>
              <Award size={14} color={colors.textOnPrimary} strokeWidth={2} />
            </View>
          ) : null}
          {!isPlayable ? (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>{t('games.comingSoonBadge')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {game.name}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Signal size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.metaText}>{t(`games.difficulty.${game.difficulty}`)}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Users size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {playersLabel(t, game.players)}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Clock size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>
              {t('games.duration.range', { min: game.duration.minMinutes, max: game.duration.maxMinutes })}
            </Text>
          </View>

          {isPlayable && <Button label={t('games.play')} onPress={() => onPress?.(game)} />}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '47%',
  },
  card: {
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.7,
  },
  thumbnailWrap: {
    width: '100%',
    aspectRatio: 1.4,
  },
  comingSoonBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
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
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: {
    padding: spacing.sm,
    gap: 4,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flexShrink: 1,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  metaText: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
