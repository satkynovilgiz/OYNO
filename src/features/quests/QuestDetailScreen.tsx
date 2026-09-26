import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronLeft, CloudOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanionMoment } from '@/components/companion/CompanionMoment';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, MediaImage, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { useAuthStore } from '@/store/useAuthStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { computeQuestProgress } from './questProgress';
import { getGuidedQuest, questStepRoute } from './questsData';
import { CLAIMED_QUESTS_KEY, useClaimedQuestIds, useQuestSignals } from './useQuests';

type RewardState = 'none' | 'claiming' | 'claimed' | 'already' | 'syncing' | 'guest';

/**
 * One quest: hero, the guide's short intro, the step path (completed /
 * current / upcoming, each opening the real screen), real progress and the
 * real reward. Completion shows the guide's line and the reward the server
 * actually granted - never a reward that didn't happen.
 */
export function QuestDetailScreen({ questId, onPressBack }: { questId: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const signals = useQuestSignals();
  const claimedIds = useClaimedQuestIds();
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  const [reward, setReward] = useState<RewardState>('none');
  const claimAttempted = useRef(false);
  const quest = getGuidedQuest(questId);
  const progress = quest ? computeQuestProgress(quest, signals) : null;
  const complete = progress?.status === 'completed';
  const alreadyClaimed = claimedIds.has(questId);

  useEffect(() => {
    if (!complete) return;
    if (!signedIn) return setReward('guest');
    if (alreadyClaimed) return setReward((current) => (current === 'claimed' ? current : 'already'));
    if (claimAttempted.current) return;
    claimAttempted.current = true;
    setReward('claiming');
    void useProgressStore
      .getState()
      .claimGuidedQuest(questId)
      .then((outcome) => {
        setReward(outcome === 'claimed' ? 'claimed' : outcome === 'alreadyClaimed' ? 'already' : 'syncing');
        void queryClient.invalidateQueries({ queryKey: CLAIMED_QUESTS_KEY });
      });
  }, [complete, signedIn, alreadyClaimed, questId, queryClient]);

  if (!quest || !progress) return <NotFoundState onPressBack={onPressBack} />;

  const pick = (text: { kg: string; ru: string; en: string }) => text[language] ?? text.kg;
  const isChild = experience === 'child';
  const openStep = (route: string | null) => route && router.push(route as never);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {quest.heroImage ? <MediaImage source={quest.heroImage} /> : null}
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.xs }]}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.theme}>{pick(quest.theme)}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {pick(quest.title)}
          </Text>

          <CompanionMoment characterId={quest.guide} moment={complete ? 'completion' : 'intro'} message={complete ? pick(quest.completion) : pick(quest.intro)} />

          <View style={styles.progressRow} accessible accessibilityLabel={t('quests.progress', { completed: progress.completed, total: progress.total })}>
            <View style={styles.bar}>
              <ProgressBar progress={progress.completed / progress.total} height={8} fillColor={complete ? colors.accentGold : colors.primary} />
            </View>
            <Text style={styles.count}>{t('quests.progress', { completed: progress.completed, total: progress.total })}</Text>
          </View>

          <View style={styles.path}>
            {progress.steps.map(({ step, state }, index) => {
              const route = questStepRoute(step);
              const unavailableOffline = !!route && isOffline && !isRouteAvailableOffline(route, queryClient);
              const label = pick(isChild ? step.short : step.instruction);
              return (
                <View key={`${step.type}:${step.targetId}`} style={[styles.step, state === 'current' && styles.stepCurrent]}>
                  <View style={[styles.marker, state === 'completed' && styles.markerDone, state === 'current' && styles.markerCurrent]}>
                    {state === 'completed' ? <Check size={14} color={colors.textPrimary} strokeWidth={3} /> : <Text style={styles.markerText}>{index + 1}</Text>}
                  </View>
                  <View style={styles.stepText}>
                    <Text style={[styles.stepLabel, state === 'upcoming' && styles.stepLabelMuted]}>{label}</Text>
                    <Text style={styles.stepState}>{t(`quests.stepState.${state}`)}</Text>
                    {unavailableOffline && state !== 'completed' ? (
                      <View style={styles.offlineRow}>
                        <CloudOff size={12} color={colors.textMuted} strokeWidth={2} />
                        <Text style={styles.offlineText}>{t('quests.needsInternet')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {state === 'current' && route ? <Button label={t('quests.go')} size="sm" onPress={() => openStep(route)} disabled={unavailableOffline} /> : null}
                  {state === 'completed' && route ? (
                    <AnimatedPressable onPress={() => openStep(route)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('quests.open')}: ${label}`}>
                      <Text style={styles.openAgain}>{t('quests.open')}</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.rewardBox} accessibilityLiveRegion="polite">
            <Text style={styles.rewardTitle}>{t('quests.rewardTitle')}</Text>
            <Text style={styles.rewardValue}>{t('quests.reward', { xp: quest.reward.xp, coins: quest.reward.coins })}</Text>
            <Text style={styles.rewardNote}>{t(`quests.rewardState.${complete ? reward : signedIn ? 'none' : 'guest'}`)}</Text>
          </View>

          {complete ? <Button label={t('quests.continueExploring')} variant="primary" size="lg" block onPress={() => router.replace('/quests' as never)} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { height: 220, backgroundColor: colors.surfaceFeature, overflow: 'hidden' },
  heroTop: { position: 'absolute', left: spacing.md },
  body: { padding: spacing.md, gap: spacing.md },
  theme: { ...textStyles.overline, color: colors.accentTerracotta },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary, marginTop: -spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { flex: 1 },
  count: { ...textStyles.caption, fontWeight: '700', color: colors.textSecondary },
  path: { gap: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  stepCurrent: { borderColor: colors.accentGold, borderWidth: 2 },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  markerDone: { backgroundColor: colors.accentGold },
  markerCurrent: { backgroundColor: colors.primary },
  markerText: { ...textStyles.small, fontWeight: '800', color: colors.textOnDark },
  stepText: { flex: 1, gap: 2 },
  stepLabel: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  stepLabelMuted: { color: colors.textSecondary },
  stepState: { ...textStyles.small, color: colors.textMuted },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offlineText: { ...textStyles.small, color: colors.textMuted },
  openAgain: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  rewardBox: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  rewardTitle: { ...textStyles.overline, color: colors.textSecondary },
  rewardValue: { ...textStyles.title, color: colors.textPrimary },
  rewardNote: { ...textStyles.caption, color: colors.textSecondary },
});
