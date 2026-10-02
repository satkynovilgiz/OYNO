import { Swords } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { formatMetric, ruleFor } from '../records/gameRecords';
import type { FriendChallenge } from './friendChallenge';

/** "Friend challenge · Beat 24 points · Play challenge" - anonymous (the
 * link carries no identity), normal mode only. */
export function FriendChallengeCard({ challenge, onPlay }: { challenge: FriendChallenge; onPlay: () => void }) {
  const { t } = useTranslation();
  const rule = ruleFor(challenge.gameId);
  if (!rule) return null;
  const target = formatMetric(rule.primary.unit, challenge.target, t);
  const goal = challenge.metric === 'time' ? t('friendChallenge.beatTime', { target }) : t('friendChallenge.beatScore', { target });
  return (
    <View style={styles.card} accessible={false}>
      <View style={styles.row} accessible accessibilityLabel={`${t('friendChallenge.title')}. ${goal}.`}>
        <Swords size={18} color={colors.accentGold} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('friendChallenge.title')}</Text>
          <Text style={styles.goal}>{goal}</Text>
        </View>
      </View>
      <Button label={t('friendChallenge.play')} onPress={onPlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.accentGold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  goal: { ...textStyles.title, color: colors.textPrimary },
});
