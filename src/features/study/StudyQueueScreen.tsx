import { router } from 'expo-router';
import { BookA, BookOpen, ChevronLeft, ChevronRight, CircleHelp, Route, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { LEARNING_PATHS, pathProgress } from '@/features/learn/learningPaths';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { useStepDisplay } from '@/features/learn/useStepDisplay';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { buildStudyQueue, filterQueue, QUICK_REVIEW_ROUTE, studyPresentation, type StudyFilter, type StudyQueueItem } from './studyQueue';
import { useStudyQueueInput } from './useStudyQueue';

const FILTERS: StudyFilter[] = ['all', 'review', 'reading', 'paths'];

/**
 * /study - My Study Queue. A compact, private list of what is already
 * unfinished in OYNO's existing systems. Nothing here is a new lesson,
 * score or reward; every row opens the existing screen. No Journal, notes
 * or collection descriptions are ever shown.
 */
export function StudyQueueScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('study_queue');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = studyPresentation(experience);
  const { input, titles, ready } = useStudyQueueInput();
  const [filter, setFilter] = useState<StudyFilter>('all');
  const queue = buildStudyQueue(input, presentation);
  const visible = filterQueue(queue, filter);
  const hasReview = input.mistakeIds.length > 0 || input.glossaryIds.length > 0;

  const review = visible.filter((item) => item.type === 'mistakes' || item.type === 'glossary');
  const paths = visible.filter((item) => item.type === 'path');
  const reading = visible.filter((item) => item.type === 'reading');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, presentation.compact && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('study.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {ready && queue.length > 0 ? (
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => (
              <AnimatedPressable
                key={option}
                style={[styles.chip, filter === option && styles.chipActive]}
                onPress={() => setFilter(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === option }}
              >
                <Text style={[styles.chipText, filter === option && styles.chipTextActive]}>{t(`study.filter.${option}`)}</Text>
              </AnimatedPressable>
            ))}
          </View>
        ) : null}

        {ready && queue.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle} accessibilityRole="header">
              {t('study.caughtUp')}
            </Text>
            <Text style={styles.meta}>{t('study.caughtUpBody')}</Text>
            <Button label={t('study.discover')} variant="secondary" size={presentation.largeActions ? 'lg' : 'md'} onPress={() => router.push('/culture/gallery' as never)} />
          </View>
        ) : null}

        {review.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('study.review')}
            </Text>
            {hasReview && (filter === 'all' || filter === 'review') ? (
              <Button
                label={t('study.quickReview')}
                size={presentation.largeActions || presentation.reviewFirstEmphasis ? 'lg' : 'md'}
                block
                icon={<Zap size={18} color={colors.textOnPrimary} strokeWidth={2} />}
                accessibilityHint={t('study.quickReviewMeta')}
                onPress={() => router.push(QUICK_REVIEW_ROUTE as never)}
              />
            ) : null}
            {review.map((item) => (
              <QueueRow
                key={item.id}
                icon={item.type === 'mistakes' ? CircleHelp : BookA}
                title={t(item.type === 'mistakes' ? 'study.questionsToReview' : 'study.termsToReview')}
                meta={t(item.type === 'mistakes' ? 'study.questionsCount' : 'study.termsCount', { count: item.count ?? 0 })}
                item={item}
                large={presentation.largeActions}
              />
            ))}
          </View>
        ) : null}

        {paths.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('study.continueLearning')}
            </Text>
            {paths.map((item) => (
              <PathQueueRow key={item.id} item={item} large={presentation.largeActions} />
            ))}
          </View>
        ) : null}

        {reading.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('study.continueReading')}
            </Text>
            {reading.map((item) => (
              <QueueRow key={item.id} icon={BookOpen} title={titles.reading[item.id] ?? ''} meta={t('study.percentRead', { percent: titles.readingPercent[item.id] ?? 0 })} item={item} large={presentation.largeActions} />
            ))}
          </View>
        ) : null}

        {ready && queue.length > 0 && visible.length === 0 ? <Text style={styles.meta}>{t('study.nothingInFilter')}</Text> : null}
      </ScrollView>
    </View>
  );
}

function QueueRow({ icon: Icon, title, meta, item, large }: { icon: typeof BookA; title: string; meta: string; item: StudyQueueItem; large: boolean }) {
  return (
    <AnimatedPressable style={[styles.row, large && styles.rowLarge]} onPress={() => router.push(item.route as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`}>
      <Icon size={large ? 22 : 18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

/** The path's next step comes from pathProgress() - the same first
 * unfinished step the path screen shows (no second algorithm). */
function PathQueueRow({ item, large }: { item: StudyQueueItem; large: boolean }) {
  const { t } = useTranslation();
  const { signals } = usePathSignals();
  const display = useStepDisplay();
  const path = LEARNING_PATHS.find((entry) => entry.id === item.id);
  if (!path) return null;
  const progress = pathProgress(path, signals);
  const next = progress.nextIndex === null ? null : display(path.steps[progress.nextIndex]);
  const meta = `${t('learningPaths.progress', { completed: progress.completed, total: progress.total })}${next ? ` · ${t('study.nextStep', { step: `${next.verb}: ${next.title}` })}` : ''}`;
  return <QueueRow icon={Route} title={t(path.titleKey)} meta={meta} item={item} large={large} />;
}

/** Compact entry row for Culture and Profile. */
export function StudyQueueEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entry} onPress={() => router.push('/study' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('study.title')}. ${t('study.entryMeta')}`}>
      <Zap size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{t('study.title')}</Text>
        <Text style={styles.meta}>{t('study.entryMeta')}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 36, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.small, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowLarge: { minHeight: 72, paddingVertical: spacing.md },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  empty: { gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
