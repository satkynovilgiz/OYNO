import { router } from 'expo-router';
import { BookOpen, ChevronLeft, CircleCheck, Gamepad2, GraduationCap, Headphones, Route, Target, Trophy, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, Chip, IconButton } from '@/components/ui';
import { collections } from '@/features/collections/collectionsData';
import { formatMetric, ruleFor } from '@/features/games/records/gameRecords';
import { useGameRecords, useRecordsOwner } from '@/features/games/records/useGameRecords';
import { gameTitleKey } from '@/features/games/types';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { gameRouteFor, useStepDisplay } from '@/features/learn/useStepDisplay';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { formatShortDate, formatTime, localDateKeyOf } from '@/services/i18n/formatDate';
import { usePrivateSyncScope } from '@/services/sync/privateSync/usePrivateSyncScope';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { buildTimeline, filterTimeline, groupTimeline, TIMELINE_FILTERS, timelineRoute, withinRange, type TimelineEvent, type TimelineFilter, type TimelineKind } from './timelineModel';

const ICON: Record<TimelineKind, LucideIcon> = {
  reading_completed: BookOpen,
  challenge_completed: CircleCheck,
  study_session: GraduationCap,
  path_step: Route,
  game_played: Gamepad2,
  personal_best: Trophy,
  listening_finished: Headphones,
};


const NO_SESSIONS: string[] = [];
/**
 * /profile/activity - Learning history: a private, dated list derived from
 * the current owner's existing records. No social, no ranks, nothing
 * uploaded; Journal, notes and collection descriptions never appear.
 */
export function LearningTimelineScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const owner = useRecordsOwner();
  const scope = usePrivateSyncScope();
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const challengeResults = useChallengeStore((state) => state.results);
  const glossarySessions = useGlossaryStudyStore((state) => state.sessions[owner] ?? NO_SESSIONS);
  const pathSteps = ownerManualSteps(useLearningPathStore((state) => state.saved), owner);
  const listening = ownerListening(useListeningStore((state) => state.saved), owner);
  const { records } = useGameRecords();
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  const display = useStepDisplay();
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [allHistory, setAllHistory] = useState(false);

  useEffect(() => {
    track('learning_timeline_opened');
    for (const store of [useReadingStore, useGlossaryStudyStore, useLearningPathStore, useListeningStore, useChallengeStore]) {
      const state = store.getState() as { isLoaded: boolean; load: () => Promise<void> };
      if (!state.isLoaded) void state.load();
    }
  }, []);

  const now = new Date();
  const events = useMemo(
    () => buildTimeline({ readings: Object.values(reading), challengeResults, glossarySessions, manualPathSteps: pathSteps, gameRecords: records, listening: Object.values(listening.history) }, new Date()),
    [reading, challengeResults, glossarySessions, pathSteps, records, listening],
  );
  const shown = withinRange(filterTimeline(events, filter), now, allHistory);
  const hiddenOlder = !allHistory && withinRange(filterTimeline(events, filter), now, true).length > shown.length;
  const groups = groupTimeline(shown, now);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  // Stale sources are only "missing" once their list has loaded.
  const exists = (ref: TimelineEvent['ref']) => {
    if (ref.type === 'culture_item') return !items || items.some((row) => row.id === ref.id);
    if (ref.type === 'culture_material') return !materials || materials.some((row) => row.id === ref.id);
    if (ref.type === 'path') return LEARNING_PATHS.some((path) => path.id === ref.id);
    if (ref.type === 'game') return !!ruleFor(ref.id);
    return true;
  };
  const titleOf = (event: TimelineEvent): string => {
    const ref = event.ref;
    switch (ref.type) {
      case 'culture_item':
        return items?.find((row) => row.id === ref.id)?.title ?? t('timeline.genericArticle');
      case 'culture_material':
        return materials?.find((row) => row.id === ref.id)?.title ?? t('timeline.genericArticle');
      case 'challenge': {
        if (ref.id.startsWith('daily:')) return t('timeline.dailyChallenge');
        if (ref.id === 'journey') return t('timeline.journeyChallenge');
        const collection = ref.id.startsWith('collection:') ? collections.find((entry) => entry.id === ref.id.slice('collection:'.length)) : undefined;
        return collection ? (collection.title[language] ?? collection.title.kg) : t('timeline.genericChallenge');
      }
      case 'path': {
        const path = LEARNING_PATHS.find((entry) => entry.id === ref.id);
        const step = path?.steps.find((entry) => entry.id === ref.stepId);
        return path ? `${t(path.titleKey)}${step ? ` · ${display(step).title}` : ''}` : t('timeline.genericPath');
      }
      case 'game': {
        const rule = ruleFor(ref.id);
        return rule ? t(gameTitleKey(rule.listId)) : t('timeline.genericGame');
      }
      case 'listening':
        return listening.history[ref.id]?.title ?? t('timeline.genericAudio');
      case 'glossary':
        return t('timeline.glossaryStudy');
    }
  };
  const valueOf = (event: TimelineEvent): string | null => {
    if (event.value === null || event.ref.type !== 'game') return null;
    const rule = ruleFor(event.ref.id);
    return rule && rule.best !== 'completion' ? formatMetric(rule.primary.unit, event.value, t) : null;
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('timeline.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {events.length > 0 ? (
          <View style={styles.filters} accessibilityRole="tablist">
            {TIMELINE_FILTERS.map((option) => (
              <Chip key={option} label={t(`timeline.filter.${option}`)} selected={filter === option} onPress={() => setFilter(option)} accessibilityRole="tab" />
            ))}
          </View>
        ) : null}

        {events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle} accessibilityRole="header">
              {t('timeline.empty')}
            </Text>
            <Text style={styles.meta}>{t('timeline.emptyBody')}</Text>
            <Button label={t('timeline.startExploring')} variant="secondary" size={isChild ? 'lg' : 'md'} onPress={() => router.push('/culture' as never)} />
          </View>
        ) : null}
        {events.length > 0 && shown.length === 0 ? <Text style={styles.meta}>{t('timeline.nothingHere')}</Text> : null}

        {groups.map(({ group, events: list }) => (
          <View key={group} style={{ gap: spacing.xs }}>
            <Text style={styles.group} accessibilityRole="header">
              {t(`timeline.group.${group}`)}
            </Text>
            {list.map((event) => {
              const Icon = ICON[event.kind];
              const route = timelineRoute(event.ref, exists, gameRouteFor);
              const title = titleOf(event);
              const value = valueOf(event);
              const dateKey = localDateKeyOf(event.at);
              const when = `${group === 'this_week' || group === 'earlier' ? `${dateKey ? formatShortDate(dateKey, language) : ''} · ` : ''}${formatTime(event.at, language)}`;
              const label = `${t(`timeline.kind.${event.kind}`)}. ${title}.${value ? ` ${value}.` : ''} ${when}.${event.weeklyGoal ? ` ${t('timeline.weeklyGoal')}.` : ''}`;
              return (
                <AnimatedPressable key={event.id} style={[styles.card, isAdult && styles.cardCompact]} disabled={!route} onPress={() => route && router.push(route as never)} accessibilityRole={route ? 'button' : 'text'} accessibilityLabel={label}>
                  <View style={[styles.icon, isChild && styles.iconLarge, event.kind === 'personal_best' && styles.iconPb]}>
                    <Icon size={isChild ? 22 : 16} color={event.kind === 'personal_best' ? colors.accentGoldPressed : colors.primary} strokeWidth={2.25} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    {!isChild ? <Text style={styles.kind}>{t(`timeline.kind.${event.kind}`)}</Text> : null}
                    <Text style={[styles.cardTitle, isChild && styles.cardTitleChild]} numberOfLines={2}>
                      {title}
                    </Text>
                    {!isChild ? (
                      <Text style={styles.meta}>
                        {value ? `${value} · ` : ''}
                        {when}
                      </Text>
                    ) : null}
                  </View>
                  {event.weeklyGoal ? <Target size={14} color={colors.accentTerracotta} strokeWidth={2.25} /> : null}
                </AnimatedPressable>
              );
            })}
          </View>
        ))}

        {hiddenOlder ? <Button label={t('timeline.allHistory')} variant="text" onPress={() => setAllHistory(true)} /> : null}
        {events.length > 0 ? <Text style={styles.scopeNote}>{t(scope === 'account' ? 'timeline.scopeAccount' : 'timeline.scopeDevice')}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  group: { ...typography.overline, color: colors.accentTerracotta },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardCompact: { minHeight: 48, paddingVertical: spacing.xs },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  iconLarge: { width: 44, height: 44, borderRadius: 22 },
  iconPb: { backgroundColor: colors.surfaceAlt },
  kind: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  cardTitleChild: { fontSize: 18 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  scopeNote: { ...textStyles.small, color: colors.textMuted },
  empty: { gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
});
