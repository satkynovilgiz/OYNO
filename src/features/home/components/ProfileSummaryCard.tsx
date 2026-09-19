import { Award, Coins, Flame, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { Pill, ProgressBar } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';

import type { PlayerSummary } from '../types';

type ProfileSummaryCardProps = {
  player: PlayerSummary;
};

/** Avatar ring diameter and name font size per cardScale - a bigger,
 * friendlier "who am I" greeting for child, a compact identity strip for
 * adult (spec "stronger character presence" vs. "smaller, more refined
 * controls"). */
const AVATAR_RING_SIZE_BY_CARD_SCALE = { large: 68, medium: 48, compact: 44, dense: 40 };
const NAME_FONT_SIZE_BY_CARD_SCALE = { large: 19, medium: 15, compact: 14, dense: 13 };

export function ProfileSummaryCard({ player }: ProfileSummaryCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const xpProgress = player.xpMax > 0 ? player.xpCurrent / player.xpMax : 0;
  const avatarRingSize = resolveByCardScale(config.cardScale, AVATAR_RING_SIZE_BY_CARD_SCALE);
  const avatarSize = avatarRingSize - 6;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.avatarRing, { width: avatarRingSize, height: avatarRingSize, borderRadius: avatarRingSize / 2 }]}>
          <View style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            <UserAvatar characterId={player.characterId} avatarConfig={player.avatarConfig} size="small" />
          </View>
        </View>

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { fontSize: resolveByCardScale(config.cardScale, NAME_FONT_SIZE_BY_CARD_SCALE) }]}
              numberOfLines={2}
            >
              {player.name}
            </Text>
            <Pencil size={12} color={colors.textSecondary} strokeWidth={2} style={styles.pencil} />
          </View>
          <Text style={styles.rank} numberOfLines={1}>
            {player.rank}
          </Text>
          <View style={styles.badgeRow}>
            <Pill label={t('home.profile.level', { level: player.level })} />
            {player.streakDays > 0 ? (
              <View style={styles.streakChip}>
                <Flame size={11} color={colors.accentTerracotta} strokeWidth={2.25} />
                <Text style={styles.streakText}>{player.streakDays}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.xpBlock}>
        <View style={styles.xpLabelRow}>
          <Text style={styles.xpLabel}>{t('home.profile.xp', { current: player.xpCurrent, max: player.xpMax })}</Text>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  streakText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  xpBlock: {
    gap: spacing.xxs,
  },
  xpLabelRow: {
    flexDirection: 'row',
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
