import { Award, Check, Coins, Flame, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { Button, LevelBadge, ProgressBar, SectionHeader, StatPill } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import type { DailyProgress, PlayerSummary } from '../types';

/**
 * Compact progress module (real data only, same claim action):
 *   primary    avatar | name / Level badge + XP      -> thin XP bar
 *   secondary  coins · achievements · streak as small stat pills
 *   sub-row    today's play goal: bar + count + small claim button
 * Preteens/children get the rewarding gold level/XP treatment.
 */
export function HomeProgressSection({
  player,
  dailyProgress,
  claimable,
  claimed,
  experience,
  onPressClaim,
}: {
  player: PlayerSummary;
  dailyProgress: DailyProgress;
  claimable: boolean;
  claimed: boolean;
  experience: AgeExperience;
  onPressClaim: () => void;
}) {
  const { t } = useTranslation();
  const xpRatio = player.xpMax > 0 ? player.xpCurrent / player.xpMax : 0;
  const playRatio = dailyProgress.progressMax > 0 ? dailyProgress.progressCurrent / dailyProgress.progressMax : 0;
  const ready = claimable && !claimed;
  const rewarding = experience === 'preteen' || experience === 'child';
  const claimLabel = t(claimed ? 'home.dailyProgress.claimedLabel' : 'home.dailyProgress.claimLabel');

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.sections.progress')} />
      <View style={styles.card}>
        <View style={styles.playerRow}>
          <View style={[styles.avatar, rewarding && styles.avatarRewarding]}>
            <UserAvatar characterId={player.characterId} avatarConfig={player.avatarConfig} size="small" />
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.levelRow}>
              <LevelBadge label={t('home.profile.level', { level: player.level })} tone={rewarding ? 'gold' : 'forest'} />
              <Text style={styles.xp} numberOfLines={1}>
                {t('home.profile.xp', { current: player.xpCurrent, max: player.xpMax })}
              </Text>
            </View>
          </View>
        </View>
        <ProgressBar progress={xpRatio} height={6} fillColor={rewarding ? colors.accentGold : colors.primary} trackColor={colors.surfaceMuted} />

        <View style={styles.stats}>
          <StatPill icon={Coins} value={player.coins.toLocaleString('ru-RU')} color={colors.accentGoldPressed} accessibilityLabel={`${player.coins} ${t('profile.stats.coins', { defaultValue: 'coins' })}`} />
          <StatPill icon={Award} value={player.gems.toLocaleString('ru-RU')} color={colors.accentTerracotta} />
          {player.streakDays > 0 ? <StatPill icon={Flame} value={player.streakDays} color={colors.accentTerracotta} /> : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.playRow}>
          <View style={[styles.playIcon, ready && styles.playIconReady]}>
            <Target size={18} color={ready ? colors.textPrimary : colors.primary} strokeWidth={2.25} />
          </View>
          <View style={styles.playText}>
            <View style={styles.playHead}>
              <Text style={styles.playTitle} numberOfLines={2}>
                {t('home.dailyProgress.title')}
              </Text>
              <Text style={styles.playCount}>
                {dailyProgress.progressCurrent}/{dailyProgress.progressMax}
              </Text>
            </View>
            <ProgressBar progress={playRatio} height={4} trackColor={colors.surfaceMuted} />
          </View>
          {/* The claim action appears only when there is something to claim;
              otherwise the row stays a light status line (no dead button). */}
          {ready ? <Button label={claimLabel} size="sm" variant="accent" onPress={onPressClaim} /> : null}
          {claimed ? (
            <View style={styles.claimed} accessible accessibilityLabel={claimLabel}>
              <Check size={13} color={colors.primary} strokeWidth={3} />
              <Text style={styles.claimedText} numberOfLines={1}>
                {claimLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  avatarRewarding: { borderColor: colors.accentGold },
  identity: { flex: 1, gap: 4, minWidth: 0 },
  name: { ...textStyles.title, color: colors.textPrimary },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  xp: { ...textStyles.caption, fontWeight: '600', color: colors.textSecondary, flexShrink: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.borderSubtle },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  playIconReady: { backgroundColor: colors.accentGold },
  playText: { flex: 1, gap: 6, minWidth: 0 },
  playHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  playTitle: { ...textStyles.caption, fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  claimed: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  claimedText: { ...textStyles.small, color: colors.primary },
  playCount: { ...textStyles.small, color: colors.textSecondary },
});
