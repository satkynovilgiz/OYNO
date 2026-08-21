import { Award, Clock, Signal, Users } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { GameListItem } from '../types';

type GameCardProps = {
  game: GameListItem;
  onPress?: (game: GameListItem) => void;
};

const DIFFICULTY_LABEL: Record<GameListItem['difficulty'], string> = {
  easy: 'Жеңил',
  medium: 'Орточо',
};

export function GameCard({ game, onPress }: GameCardProps) {
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
              <Text style={styles.comingSoonText}>Жакында</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {game.name}
          </Text>

          <View style={styles.metaRow}>
            <Signal size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>{DIFFICULTY_LABEL[game.difficulty]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Users size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>{game.players}</Text>
          </View>
          <View style={styles.metaRow}>
            <Clock size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>{game.duration}</Text>
          </View>

          {isPlayable ? (
            <Button label="Ойноо" onPress={() => onPress?.(game)} />
          ) : (
            <View style={styles.disabledButton}>
              <Text style={styles.disabledButtonLabel}>Жакында</Text>
            </View>
          )}
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
  disabledButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  disabledButtonLabel: {
    ...typography.caption,
    color: colors.textMuted,
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
    gap: 3,
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
  metaText: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
