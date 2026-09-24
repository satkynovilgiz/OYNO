import { Award, Coins, Flame, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { AnimatedPressable, ProgressBar } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, radii, spacing, typography } from '@/theme';

import type { DailyProgress, PlayerSummary } from '../types';

import { HOME_RADIUS, HomeSectionHeader } from './homeKit';

/**
 * "Your progress" - one calm grouped card (visual grouping only; the data
 * and the claim action are exactly the existing ones):
 *   primary   - avatar, name, Level + XP bar
 *   secondary - coins / gems / streak as small quiet figures
 *   below     - today's play goal with its real claim state
 * Preteens get the more rewarding gold XP treatment; adults the calmest.
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

  return (
    <View style={styles.section}>
      <HomeSectionHeader title={t('home.sections.progress')} />
      <View style={styles.card}>
        <View style={styles.playerRow}>
          <View style={styles.avatar}>
            <UserAvatar characterId={player.characterId} avatarConfig={player.avatarConfig} size="small" />
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.levelRow}>
              <View style={[styles.level, rewarding && styles.levelRewarding]}>
                <Text style={[styles.levelText, rewarding && styles.levelTextRewarding]}>{t('home.profile.level', { level: player.level })}</Text>
              </View>
              <Text style={styles.xpText}>{t('home.profile.xp', { current: player.xpCurrent, max: player.xpMax })}</Text>
            </View>
          </View>
        </View>
        <ProgressBar progress={xpRatio} height={6} fillColor={rewarding ? colors.accentGold : undefined} />

        <View style={styles.secondaryRow} accessible accessibilityLabel={`${player.coins} ${t('profile.stats.coins', { defaultValue: 'coins' })}, ${player.gems}`}>
          <View style={styles.stat}>
            <Coins size={14} color={colors.accentGoldPressed} strokeWidth={2} />
            <Text style={styles.statText}>{player.coins.toLocaleString('ru-RU')}</Text>
          </View>
          <View style={styles.stat}>
            <Award size={14} color={colors.accentSilver} strokeWidth={2} />
            <Text style={styles.statText}>{player.gems.toLocaleString('ru-RU')}</Text>
          </View>
          {player.streakDays > 0 ? (
            <View style={styles.stat}>
              <Flame size={14} color={colors.accentTerracotta} strokeWidth={2} />
              <Text style={styles.statText}>{player.streakDays}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.playRow}>
          <View style={styles.playIcon}>
            <Target size={18} color={ready ? colors.accentGoldPressed : colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.playText}>
            <Text style={styles.playTitle}>{t('home.dailyProgress.title')}</Text>
            <View style={styles.playProgress}>
              <ProgressBar progress={playRatio} height={5} style={styles.playBar} />
              <Text style={styles.playCount}>
                {dailyProgress.progressCurrent} / {dailyProgress.progressMax}
              </Text>
            </View>
          </View>
          <AnimatedPressable
            style={[styles.claim, ready ? styles.claimReady : styles.claimIdle]}
            onPress={ready ? onPressClaim : undefined}
            disabled={!ready}
            haptic={ready ? 'medium' : false}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            accessibilityLabel={t(claimed ? 'home.dailyProgress.claimedLabel' : 'home.dailyProgress.claimLabel')}
          >
            <Text style={[styles.claimText, ready && styles.claimTextReady]} numberOfLines={1}>
              {t(claimed ? 'home.dailyProgress.claimedLabel' : 'home.dailyProgress.claimLabel')}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: HOME_RADIUS.standard, backgroundColor: colors.surface },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: colors.accentGold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  identity: { flex: 1, gap: 4 },
  name: { ...typography.bodyBold, fontSize: 17, color: colors.textPrimary },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  level: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.primary },
  levelRewarding: { backgroundColor: colors.accentGold },
  levelText: { ...typography.small, fontWeight: '700', color: colors.textOnDark },
  levelTextRewarding: { color: colors.textPrimary },
  xpText: { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  secondaryRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.surfaceAlt },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  playText: { flex: 1, gap: 4 },
  playTitle: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
  playProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  playBar: { flex: 1 },
  playCount: { ...typography.small, fontWeight: '700', color: colors.textSecondary },
  claim: { minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', maxWidth: 130 },
  claimReady: { backgroundColor: colors.accentGold },
  claimIdle: { backgroundColor: colors.surfaceAlt },
  claimText: { ...typography.small, fontWeight: '700', color: colors.textMuted },
  claimTextReady: { color: colors.textPrimary },
});
