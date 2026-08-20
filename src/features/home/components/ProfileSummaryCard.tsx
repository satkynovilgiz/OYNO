import { Award, Coins, Pencil, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Card, Pill, ProgressBar } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { PlayerSummary } from '../types';

type ProfileSummaryCardProps = {
  player: PlayerSummary;
};

export function ProfileSummaryCard({ player }: ProfileSummaryCardProps) {
  const { t } = useTranslation();
  const xpProgress = player.xpMax > 0 ? player.xpCurrent / player.xpMax : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          {player.avatarSource ? (
            <Image source={player.avatarSource} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <UserRound size={30} color={colors.primary} strokeWidth={1.75} />
          )}
        </View>

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}
            </Text>
            <Pencil size={14} color={colors.textSecondary} strokeWidth={2} />
          </View>
          <Text style={styles.rank}>{player.rank}</Text>
          <Pill label={t('home.profile.level', { level: player.level })} />
        </View>
      </View>

      <View style={styles.xpBlock}>
        <Text style={styles.xpLabel}>
          {t('home.profile.xp', { current: player.xpCurrent, max: player.xpMax })}
        </Text>
        <ProgressBar progress={xpProgress} />
      </View>

      <View style={styles.currencyRow}>
        <View style={styles.currencyChip}>
          <Coins size={16} color={colors.accentGold} strokeWidth={2} />
          <Text style={styles.currencyText}>{player.coins.toLocaleString('ru-RU')}</Text>
        </View>
        <View style={styles.currencyChip}>
          <Award size={16} color={colors.accentSilver} strokeWidth={2} />
          <Text style={styles.currencyText}>{player.gems.toLocaleString('ru-RU')}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identity: {
    flex: 1,
    gap: spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  name: {
    ...typography.h1,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  rank: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  xpBlock: {
    gap: spacing.xxs,
  },
  xpLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  currencyText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
