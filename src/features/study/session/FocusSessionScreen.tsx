import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookA, BookOpen, Check, ChevronLeft, CircleHelp, Route, SkipForward, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconButton } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';
import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { GlossaryStudyScreen } from '@/features/culture/glossary/study/GlossaryStudyScreen';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { studyPresentation } from '../studyQueue';
import { useStudyQueueInput } from '../useStudyQueue';
import {
  buildStudySession,
  currentActivity,
  currentGroup,
  endSession,
  isFinished,
  markAttempted,
  refreshSession,
  SESSION_SIZES,
  sessionFor,
  sessionSummary,
  sizesFor,
  skipActivity,
  startSession,
  type FocusSession,
  type SessionActivityState,
  type SessionSize,
} from './focusSession';
import { applyStudyReminders, useStudyReminders, WEEKDAYS } from './studyReminders';
import { useCompletionSignals } from './useCompletionSignals';
import { useFocusSessionStore } from './useFocusSessionStore';

const ICONS = { mistake: CircleHelp, glossary: BookA, path_step: Route, reading: BookOpen } as const;
type Phase = 'mistake' | 'glossary' | null;

const analyticsProps = (session: FocusSession) => {
  const summary = sessionSummary(session);
  return { requested_size: summary.requested, completed_count: summary.completed, skipped_count: summary.skipped };
};

/**
 * /study/session - Study Planner + Focus Sessions. Pick a size (Quick 3 /
 * Standard 5 / Deep 8), then work through review first, Learning Path next
 * steps and unfinished reading - each in its EXISTING screen. Progress only
 * moves when that screen's own record changes; "Skip for now" and "End
 * session" are always available; the summary is neutral (no score).
 */
export function FocusSessionScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('study_session');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = studyPresentation(experience);
  const owner = useRecordsOwner();
  const stored = useFocusSessionStore((state) => state.session);
  const setSession = useFocusSessionStore((state) => state.setSession);
  const session = sessionFor(stored, owner);
  const { input, titles, ready } = useStudyQueueInput();
  const { signals, readingFurthest } = useCompletionSignals();
  const sizes = sizesFor(experience);
  const [size, setSize] = useState<SessionSize>(sizes[0]);
  const [phase, setPhase] = useState<Phase>(null);

  // Another account (or guest) never continues this session.
  useEffect(() => {
    if (stored && !session) setSession(null);
  }, [stored, session, setSession]);

  // Completion only from the real records; finishing the last one ends the session.
  useEffect(() => {
    if (!session || session.endedAt) return;
    let next = refreshSession(session, signals);
    if (isFinished(next)) {
      next = endSession(next);
      track('study_session_completed', analyticsProps(next));
    }
    if (next !== session) setSession(next);
  }, [session, signals, setSession]);

  const back = () => (phase ? setPhase(null) : onPressBack());

  if (session && phase) {
    const group = currentGroup(session);
    const ids = group.map((activity) => activity.refId);
    const done = { label: t('studySession.backToSession'), run: () => setPhase(null) };
    if (phase === 'mistake') return <ChallengeRunScreen challengeId="review" onPressBack={back} quick={{ limit: ids.length, only: ids, nextLabel: done.label, onNext: done.run }} />;
    return <GlossaryStudyScreen mode="review" limit={ids.length} only={ids} onPressBack={back} onDone={done} />;
  }

  const planned = buildStudySession(input, size, readingFurthest);
  const begin = () => {
    if (planned.length === 0) return;
    const started = startSession(owner, size, planned);
    setSession(started);
    track('study_session_started', analyticsProps(started));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={back} />
        <Text style={[styles.title, presentation.compact && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('studySession.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {session && session.endedAt ? (
          <Summary session={session} onDone={() => setSession(null)} />
        ) : session ? (
          <ActiveSession session={session} titles={titles.reading} onRun={setPhase} />
        ) : (
          <>
            <Text style={styles.intro}>{t(experience === 'child' ? 'studySession.introChild' : 'studySession.intro')}</Text>
            {sizes.length > 1 ? (
              <View style={styles.sizes} accessibilityRole="tablist">
                {sizes.map((value) => (
                  <Chip key={value} label={t(`studySession.size.${value}`, { count: SESSION_SIZES[value] })} selected={size === value} accessibilityRole="tab" onPress={() => setSize(value)} />
                ))}
              </View>
            ) : null}
            {ready ? (
              <Text style={styles.meta}>
                {planned.length === 0
                  ? t('studySession.nothingReady')
                  : planned.length < SESSION_SIZES[size]
                    ? t('studySession.shorter', { count: planned.length })
                    : t('studySession.ready', { count: planned.length })}
              </Text>
            ) : null}
            {ready && planned.length === 0 ? (
              <Button label={t('study.discover')} variant="secondary" onPress={() => router.push('/culture/gallery' as never)} />
            ) : (
              <Button label={t('studySession.start')} size={presentation.largeActions ? 'lg' : 'md'} disabled={!ready || planned.length === 0} onPress={begin} />
            )}
            <RemindersCard />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function useActivityLabel() {
  const { t } = useTranslation();
  return (activity: SessionActivityState, readingTitles: Record<string, string>): string => {
    switch (activity.type) {
      case 'mistake':
        return t('studySession.activity.mistake');
      case 'glossary':
        return t('studySession.activity.glossary', { term: GLOSSARY.find((entry) => entry.id === activity.refId)?.term ?? '' });
      case 'path_step': {
        const path = LEARNING_PATHS.find((candidate) => candidate.id === activity.refId);
        return t('studySession.activity.path', { path: path ? t(path.titleKey) : '' });
      }
      case 'reading':
        return t('studySession.activity.reading', { title: readingTitles[activity.refId] ?? '' });
    }
  };
}

function ActiveSession({ session, titles, onRun }: { session: FocusSession; titles: Record<string, string>; onRun: (phase: Phase) => void }) {
  const { t } = useTranslation();
  const setSession = useFocusSessionStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const label = useActivityLabel();
  const current = currentActivity(session);
  const summary = sessionSummary(session);
  const position = summary.completed + summary.skipped + 1;
  const needsConnection = !!current && isOffline && !isRouteAvailableOffline(current.route, queryClient);

  const start = () => {
    if (!current) return;
    const group = currentGroup(session);
    setSession(markAttempted(session, group.map((activity) => activity.key)));
    if (current.type === 'mistake' || current.type === 'glossary') onRun(current.type);
    else router.push(current.route as never);
  };
  const end = () => {
    const ended = endSession(session);
    setSession(ended);
    track('study_session_ended_early', analyticsProps(ended));
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.progress} accessibilityLiveRegion="polite">
        {t('studySession.progress', { current: Math.min(position, summary.total), total: summary.total })}
      </Text>
      {current ? (
        <View style={styles.current}>
          <Text style={styles.currentLabel}>{t('studySession.now')}</Text>
          <Text style={styles.currentTitle}>{label(current, titles)}</Text>
          {current.attempted ? <Text style={styles.meta}>{t('studySession.notYet')}</Text> : null}
          {needsConnection ? (
            <View style={styles.offline}>
              <WifiOff size={14} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.meta}>{t('studySession.needsConnection')}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button label={current.attempted ? t('studySession.tryAgain') : t('studySession.startActivity')} disabled={needsConnection} onPress={start} />
            <Button label={t('studySession.skip')} variant="secondary" icon={<SkipForward size={14} color={colors.primary} strokeWidth={2} />} onPress={() => setSession(skipActivity(session, current.key))} />
          </View>
        </View>
      ) : null}
      <View style={styles.list}>
        {session.activities.map((activity) => {
          const Icon = activity.status === 'done' ? Check : ICONS[activity.type];
          const status = t(`studySession.status.${activity.status}`);
          return (
            <View key={activity.key} style={[styles.item, activity === current && styles.itemCurrent]} accessible accessibilityLabel={`${label(activity, titles)}. ${status}`}>
              <Icon size={16} color={activity.status === 'done' ? colors.primary : colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.itemText, activity.status === 'skipped' && styles.itemSkipped]} numberOfLines={2}>
                {label(activity, titles)}
              </Text>
              <Text style={styles.meta}>{status}</Text>
            </View>
          );
        })}
      </View>
      <Button label={t('studySession.end')} variant="secondary" onPress={end} />
    </View>
  );
}

function Summary({ session, onDone }: { session: FocusSession; onDone: () => void }) {
  const { t } = useTranslation();
  const summary = sessionSummary(session);
  return (
    <View style={styles.summary} accessible accessibilityLabel={`${t('studySession.summaryTitle')}. ${t('studySession.summaryBody', summary)}`}>
      <Text style={styles.currentTitle} accessibilityRole="header">
        {t('studySession.summaryTitle')}
      </Text>
      <Text style={styles.intro}>{t('studySession.summaryBody', summary)}</Text>
      <Button
        label={t('study.backToStudy')}
        onPress={() => {
          onDone();
          router.replace('/study' as never);
        }}
      />
      <Button label={t('studySession.another')} variant="secondary" onPress={onDone} />
    </View>
  );
}

function RemindersCard() {
  const { t } = useTranslation();
  const settings = useStudyReminders((state) => state.settings);
  useEffect(() => {
    void useStudyReminders.getState().load();
  }, []);
  const update = async (next: typeof settings) => {
    useStudyReminders.getState().save(next);
    const result = await applyStudyReminders(next, { title: 'OYNO', body: t('studySession.reminders.body') });
    if (result === 'denied' || result === 'unavailable') {
      useStudyReminders.getState().save({ ...next, enabled: false });
      showToast(t(`studySession.reminders.${result}`), { tone: 'info' });
    }
  };
  const time = `${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}`;
  const hours = [8, 13, 18, 20];
  return (
    <View style={styles.reminders}>
      <View style={styles.reminderRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.itemText}>{t('studySession.reminders.title')}</Text>
          <Text style={styles.meta}>{t('studySession.reminders.hint')}</Text>
        </View>
        <Switch value={settings.enabled} onValueChange={(enabled) => void update({ ...settings, enabled })} accessibilityLabel={t('studySession.reminders.title')} />
      </View>
      {settings.enabled ? (
        <>
          <View style={styles.sizes}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={t(`studySession.reminders.day${day}`)}
                selected={settings.days.includes(day)}
                onPress={() => void update({ ...settings, days: settings.days.includes(day) ? settings.days.filter((value) => value !== day) : [...settings.days, day] })}
              />
            ))}
          </View>
          <View style={styles.sizes} accessibilityLabel={t('studySession.reminders.time', { time })}>
            {hours.map((hour) => (
              <Chip key={hour} label={`${String(hour).padStart(2, '0')}:00`} selected={settings.hour === hour && settings.minute === 0} onPress={() => void update({ ...settings, hour, minute: 0 })} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  intro: { ...textStyles.body, color: colors.textSecondary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  progress: { ...typography.overline, color: colors.accentTerracotta },
  current: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  currentLabel: { ...typography.overline, color: colors.textSecondary },
  currentTitle: { ...typography.h2, color: colors.textPrimary },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  list: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.borderSubtle },
  itemCurrent: { backgroundColor: colors.surfaceMuted },
  itemText: { ...textStyles.bodyMedium, color: colors.textPrimary, flex: 1 },
  itemSkipped: { color: colors.textSecondary },
  summary: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  reminders: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, marginTop: spacing.md },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
