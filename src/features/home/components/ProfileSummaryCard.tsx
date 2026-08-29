import { Award, Coins, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
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
          <UserAvatar characterId={player.characterId} avatarConfig={player.avatarConfig} size="small" />
        </View>

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>
              {player.name}
            </Text>
            <Pencil size={12} color={colors.textSecondary} strokeWidth={2} style={styles.pencil} />
          </View>
          <Text style={styles.rank} numberOfLines={1}>
            {player.rank}
          </Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identity: {
    flex: 1,
    gap: spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xxs,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flexShrink: 1,
    lineHeight: 17,
  },
  pencil: {
    marginTop: 2,
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
