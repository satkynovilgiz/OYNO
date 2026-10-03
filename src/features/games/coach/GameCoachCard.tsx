import { Lightbulb, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { track } from '@/services/analytics/analytics';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { useGameRecords, useRecordsOwner } from '../records/useGameRecords';
import { coachAdvice } from './gameCoach';

/** "Hide this tip" lasts for this app session only (never a permanent mute). */
const hiddenThisSession = new Set<string>();

/**
 * Game Detail: at most ONE compact coach card, only when there is something
 * real to say. First time -> the existing tutorial's first step (no fake
 * personalization). Reads the current owner's records only.
 */
export function GameCoachCard({ gameId, tutorialStepKeys, age, onPressPractice, onReplayTutorial }: { gameId: string; tutorialStepKeys: string[]; age: AgeExperience; onPressPractice: () => void; onReplayTutorial: () => void }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const { records, isLoaded } = useGameRecords();
  const advice = isLoaded ? coachAdvice(gameId, records.recent[gameId] ?? []) : { kind: 'none' as const };
  const hideKey = `${owner}:${gameId}:${advice.kind === 'tip' ? advice.tip.tipId : advice.kind}`;
  const [hidden, setHidden] = useState(() => hiddenThisSession.has(hideKey));
  const tipId = advice.kind === 'tip' ? advice.tip.tipId : null;

  useEffect(() => {
    setHidden(hiddenThisSession.has(hideKey));
  }, [hideKey]);
  useEffect(() => {
    if (tipId && !hiddenThisSession.has(hideKey)) track('game_coach_tip_shown', { game_id: gameId, tip_id: tipId });
  }, [tipId, gameId, hideKey]);

  if (advice.kind === 'none' || hidden) return null;
  const large = age === 'child';
  const text =
    advice.kind === 'tip'
      ? t(age === 'child' ? `gameCoach.short.${advice.tip.tipId}` : advice.tip.tipKey)
      : t('gameCoach.firstTime', { step: t(tutorialStepKeys[0] ?? '') });

  return (
    <View style={[styles.card, age === 'adult' && styles.cardCompact]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Lightbulb size={large ? 20 : 16} color={colors.accentGold} strokeWidth={2.25} />
        <Text style={styles.kicker}>{advice.kind === 'tip' ? t('gameCoach.title') : t('gameCoach.firstTimeTitle')}</Text>
        <AnimatedPressable
          style={styles.hide}
          hitSlop={8}
          onPress={() => {
            hiddenThisSession.add(hideKey);
            setHidden(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('gameCoach.hide')}
        >
          <X size={16} color={colors.textMuted} strokeWidth={2} />
        </AnimatedPressable>
      </View>
      <Text style={[styles.text, large && styles.textLarge]}>{text}</Text>
      <View style={styles.actions}>
        {advice.kind === 'first_time' ? (
          <Button label={t('gameCoach.replayTutorial')} size={large ? 'lg' : 'md'} variant="secondary" onPress={onReplayTutorial} />
        ) : advice.tip.practice ? (
          <Button
            label={t('gameDetail.practice')}
            size={large ? 'lg' : 'md'}
            variant="secondary"
            onPress={() => {
              track('game_coach_tip_opened', { game_id: gameId, tip_id: advice.tip.tipId });
              onPressPractice();
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentGold },
  cardCompact: { padding: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kicker: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracotta, flex: 1 },
  hide: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: { ...textStyles.body, color: colors.textPrimary },
  textLarge: { fontSize: 18, lineHeight: 26 },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
