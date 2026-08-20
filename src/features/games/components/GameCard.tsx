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
  return (
    <View style={styles.pressable}>
      <Card padded={false} style={styles.card}>
        <View style={styles.thumbnailWrap}>
          <Image source={game.thumbnail} style={styles.thumbnail} resizeMode="cover" />
          {game.featured ? (
            <View style={styles.badge}>
              <Award size={14} color={colors.textOnPrimary} strokeWidth={2} />
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

          <Button label="Ойноо" onPress={() => onPress?.(game)} />
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
  thumbnailWrap: {
    width: '100%',
    aspectRatio: 1.4,
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
