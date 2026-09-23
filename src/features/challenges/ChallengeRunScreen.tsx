import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton, ProgressBar } from '@/components/ui';
import { getCollection, type Collection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useShareCard } from '@/services/share/useShareCard';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { CHILD_DAILY_QUESTION_COUNT, collectionQuestionIds, DAILY_QUESTION_COUNT, journeyQuestionIds, pickDailyQuestionIds, scoreAnswers, type AnswerRecord } from './challengeLogic';
import { getQuestion, routeForSource, type ChallengeOption, type ChallengeQuestion, type OptionImageRef } from './questionBank';

function imageFor(ref: OptionImageRef | undefined): ImageSourcePropType | null {
  if (!ref) return null;
  return ref.type === 'destination' ? (natureSiteImages[ref.id] ?? null) : (cultureItemImages[ref.id]?.[0] ?? null);
}

/**
 * One quiz screen for every challenge (`daily`, `collection-<id>`,
 * `journey`). Answer -> immediate feedback (icon + words, never colour
 * alone, and announced to screen readers), the source's own explanation,
 * "Learn more" into the real detail screen, then Next. Results show the
 * real score, the questions reviewed, their sources and where to explore
 * next. No XP is taken away; nothing is marked discovered.
 */
export function ChallengeRunScreen({ challengeId, onPressBack }: { challengeId: string; onPressBack: () => void }) {
  useTrackScreenView('challenge_run');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isAdult = experience === 'adult';
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);
  const storeLoaded = useChallengeStore((state) => state.isLoaded);
  const { data: cultureItems } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  const { data: regions } = useExploreRegions();
  const { share, shareHost } = useShareCard();

  useEffect(() => {
    if (!useChallengeStore.getState().isLoaded) void useChallengeStore.getState().load();
  }, []);

  const today = localDateKey();
  const collection: Collection | undefined = challengeId.startsWith('collection-') ? getCollection(challengeId.slice('collection-'.length)) : undefined;
  const resultKey = challengeId === 'daily' ? `daily:${today}` : collection ? `collection:${collection.id}` : 'journey';

  const questions = useMemo<ChallengeQuestion[]>(() => {
    if (!storeLoaded) return [];
    let ids: string[] = [];
    if (challengeId === 'daily') {
      const count = experience === 'child' ? CHILD_DAILY_QUESTION_COUNT : DAILY_QUESTION_COUNT;
      // Pure during render; today's identity is persisted in the effect below.
      ids = useChallengeStore.getState().storedDailyIds(today) ?? pickDailyQuestionIds(today, count);
    } else if (collection) ids = collectionQuestionIds(collection);
    else if (challengeId === 'journey') ids = journeyQuestionIds(visitedRegionIds, Object.values(dailyCompletions));
    return ids.map(getQuestion).filter((question): question is ChallengeQuestion => !!question);
    // Fixed for the session once chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLoaded, challengeId]);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (questions.length === 0) return;
    if (challengeId === 'daily') useChallengeStore.getState().dailyQuestionIds(today, () => questions.map((question) => question.id));
    useChallengeStore.getState().start(resultKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, resultKey]);

  const title = challengeId === 'daily' ? t('challenges.daily.title') : collection ? (collection.title[language] ?? collection.title.kg) : t('challenges.journey.title');

  function sourceTitle(question: ChallengeQuestion): string {
    if (question.sourceType === 'destination') {
      const row = regions?.find((region) => region.id === question.sourceId);
      return row ? (mapExploreRegionName(row)[language] ?? row.name_kg) : question.sourceId;
    }
    if (question.sourceType === 'culture_material') return materials?.find((row) => row.id === question.sourceId)?.title ?? question.sourceId;
    return cultureItems?.find((row) => row.id === question.sourceId)?.title ?? question.sourceId;
  }

  function optionLabel(question: ChallengeQuestion, option: ChallengeOption, position: number): string {
    if (question.kind === 'trueFalse') return t(`challenges.${option.id}`);
    if (question.kind === 'image') return t('challenges.pictureLabel', { index: position + 1 });
    return t(`challenges.questions.${question.id}.options.${option.id}`);
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>
        {storeLoaded ? <Text style={styles.emptyText}>{t('challenges.journey.locked')}</Text> : null}
      </View>
    );
  }

  const { correct, total } = scoreAnswers(answers);

  if (finished) {
    const wrongSources = Array.from(new Map(questions.filter((question) => !answers.some((a) => a.questionId === question.id && a.optionId === question.correctOptionId)).map((q) => [`${q.sourceType}:${q.sourceId}`, q])).values());
    const allSources = Array.from(new Map(questions.map((q) => [`${q.sourceType}:${q.sourceId}`, q])).values());
    const shareImage = collection?.heroImage ?? imageFor(questions[0].sourceType === 'destination' ? { type: 'destination', id: questions[0].sourceId } : { type: 'culture_item', id: questions[0].sourceId }) ?? null;
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.header}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          </View>
          <View style={styles.resultCard} accessible accessibilityLabel={`${title}. ${t('challenges.resultTitle', { correct, total })}`}>
            <OymoOrnament size={18} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.resultEyebrow}>{title}</Text>
            <Text style={styles.resultScore}>{t('challenges.resultTitle', { correct, total })}</Text>
            <Text style={styles.resultBody}>{t('challenges.resultBody')}</Text>
            <AnimatedPressable
              style={styles.shareLink}
              onPress={() =>
                void share({ title, label: t('challenges.shareTitle'), imageSource: shareImage, completedLabel: `${correct} / ${total}` }, `${t('challenges.shareTitle')}: ${correct} / ${total}`)
              }
              accessibilityRole="button"
              accessibilityLabel={t('share.action')}
            >
              <Text style={styles.shareText}>{t('share.action')}</Text>
            </AnimatedPressable>
          </View>

          <Text style={styles.sectionTitle}>{t('challenges.reviewed')}</Text>
          {questions.map((question) => {
            const ok = answers.some((a) => a.questionId === question.id && a.optionId === question.correctOptionId);
            return (
              <View key={question.id} style={styles.reviewRow} accessible accessibilityLabel={`${t(`challenges.questions.${question.id}.question`)}. ${ok ? t('challenges.answerCorrectA11y') : t('challenges.answerWrongA11y')}`}>
                {ok ? <Check size={16} color={colors.primary} strokeWidth={3} /> : <X size={16} color={colors.accentTerracotta} strokeWidth={3} />}
                <Text style={styles.reviewText}>{t(`challenges.questions.${question.id}.question`)}</Text>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>{t('challenges.sources')}</Text>
          {allSources.map((question) => (
            <SourceLink key={`${question.sourceType}:${question.sourceId}`} label={sourceTitle(question)} route={routeForSource(question)} />
          ))}

          {wrongSources.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('challenges.exploreNext')}</Text>
              {wrongSources.map((question) => (
                <SourceLink key={`next-${question.sourceType}:${question.sourceId}`} label={sourceTitle(question)} route={routeForSource(question)} />
              ))}
            </>
          ) : null}

          <AnimatedPressable style={styles.primary} onPress={() => router.replace('/challenges' as never)} accessibilityRole="button" accessibilityLabel={t('challenges.backToChallenges')}>
            <Text style={styles.primaryText}>{t('challenges.backToChallenges')}</Text>
          </AnimatedPressable>
        </ScrollView>
        {shareHost}
      </View>
    );
  }

  const question = questions[index];
  const answered = selected !== null;
  const isCorrect = selected === question.correctOptionId;
  const correctOption = question.options.find((option) => option.id === question.correctOptionId)!;

  function choose(optionId: string) {
    if (answered) return;
    setSelected(optionId);
    setAnswers([...answers, { questionId: question.id, optionId }]);
    const message =
      optionId === question.correctOptionId
        ? t('challenges.correct')
        : question.kind === 'image'
          ? t('challenges.incorrectImage')
          : t('challenges.incorrect', { answer: optionLabel(question, correctOption, question.options.indexOf(correctOption)) });
    AccessibilityInfo.announceForAccessibility(message);
  }

  function next() {
    if (index + 1 >= questions.length) {
      const score = scoreAnswers(answers);
      useChallengeStore.getState().complete(resultKey, score.correct, score.total);
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          <View style={styles.headerText}>
            <Text style={styles.kicker}>{title}</Text>
            <Text style={styles.counter}>{t('challenges.questionOf', { index: index + 1, total: questions.length })}</Text>
          </View>
        </View>
        <ProgressBar progress={(index + (answered ? 1 : 0)) / questions.length} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />

        <Text style={[styles.question, isAdult && styles.questionEditorial, experience === 'child' && styles.questionChild]} accessibilityRole="header">
          {t(`challenges.questions.${question.id}.question`)}
        </Text>

        <Options question={question} experience={experience} selected={selected} onChoose={choose} labelFor={(option, position) => optionLabel(question, option, position)} />

        {answered ? (
          <View style={[styles.feedback, isCorrect ? styles.feedbackRight : styles.feedbackWrong]} accessibilityLiveRegion="polite">
            <View style={styles.feedbackHeader}>
              {isCorrect ? <Check size={18} color={colors.primary} strokeWidth={3} /> : <OymoOrnament size={14} color={colors.accentTerracotta} strokeWidth={1.75} />}
              <Text style={[styles.feedbackTitle, !isCorrect && styles.feedbackTitleWrong]}>
                {isCorrect
                  ? t('challenges.correct')
                  : question.kind === 'image'
                    ? t('challenges.incorrectImage')
                    : t('challenges.incorrect', { answer: optionLabel(question, correctOption, question.options.indexOf(correctOption)) })}
              </Text>
            </View>
            <Text style={styles.explanation}>{t(`challenges.questions.${question.id}.explanation`)}</Text>
            <View style={styles.feedbackActions}>
              <AnimatedPressable onPress={() => router.push(routeForSource(question) as never)} accessibilityRole="link" accessibilityLabel={`${t('challenges.learnMore')}: ${sourceTitle(question)}`}>
                <Text style={styles.learnMore}>{t('challenges.learnMore')} →</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.nextButton} onPress={next} pressScale={0.97} haptic="light" accessibilityRole="button" accessibilityLabel={index + 1 >= questions.length ? t('challenges.finish') : t('challenges.next')}>
                <Text style={styles.nextText}>{index + 1 >= questions.length ? t('challenges.finish') : t('challenges.next')}</Text>
                <ChevronRight size={16} color={colors.accentGold} strokeWidth={2.5} />
              </AnimatedPressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Options({
  question,
  experience,
  selected,
  onChoose,
  labelFor,
}: {
  question: ChallengeQuestion;
  experience: AgeExperience;
  selected: string | null;
  onChoose: (optionId: string) => void;
  labelFor: (option: ChallengeOption, position: number) => string;
}) {
  const { t } = useTranslation();
  const answered = selected !== null;
  const large = experience === 'child' || experience === 'preteen';

  function stateOf(option: ChallengeOption): 'idle' | 'correct' | 'wrong' | 'dim' {
    if (!answered) return 'idle';
    if (option.id === question.correctOptionId) return 'correct';
    return option.id === selected ? 'wrong' : 'dim';
  }

  function a11y(option: ChallengeOption, position: number): string {
    const state = stateOf(option);
    const base = labelFor(option, position);
    if (state === 'correct') return `${base}, ${t('challenges.answerCorrectA11y')}`;
    if (state === 'wrong') return `${base}, ${t('challenges.answerWrongA11y')}`;
    return base;
  }

  if (question.kind === 'image') {
    return (
      <View style={[styles.imageGrid, large && styles.imageGridLarge]}>
        {question.options.map((option, position) => {
          const state = stateOf(option);
          const image = imageFor(option.image);
          return (
            <AnimatedPressable
              key={option.id}
              style={[styles.imageOption, large && styles.imageOptionLarge, state === 'correct' && styles.optionCorrect, state === 'wrong' && styles.optionWrong, state === 'dim' && styles.optionDim]}
              onPress={() => onChoose(option.id)}
              disabled={answered}
              accessibilityRole="button"
              accessibilityState={{ selected: option.id === selected, disabled: answered }}
              accessibilityLabel={a11y(option, position)}
            >
              {image ? <Image source={image} style={styles.imageFill} resizeMode="cover" /> : null}
              {state === 'correct' || state === 'wrong' ? <StateBadge correct={state === 'correct'} /> : null}
            </AnimatedPressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.optionList, question.kind === 'trueFalse' && styles.optionRow]}>
      {question.options.map((option, position) => {
        const state = stateOf(option);
        return (
          <AnimatedPressable
            key={option.id}
            style={[
              styles.option,
              question.kind === 'trueFalse' && styles.optionHalf,
              large && styles.optionLarge,
              state === 'correct' && styles.optionCorrect,
              state === 'wrong' && styles.optionWrong,
              state === 'dim' && styles.optionDim,
            ]}
            onPress={() => onChoose(option.id)}
            disabled={answered}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityState={{ selected: option.id === selected, disabled: answered }}
            accessibilityLabel={a11y(option, position)}
          >
            <Text style={[styles.optionText, large && styles.optionTextLarge]}>{labelFor(option, position)}</Text>
            {state === 'correct' || state === 'wrong' ? <StateBadge correct={state === 'correct'} inline /> : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

/** ✓ / ✕ badge - the shape carries the meaning, not just the colour. */
function StateBadge({ correct, inline = false }: { correct: boolean; inline?: boolean }) {
  return (
    <View style={[styles.badge, inline ? styles.badgeInline : styles.badgeCorner, correct ? styles.badgeCorrect : styles.badgeWrong]}>
      {correct ? <Check size={14} color={colors.textPrimary} strokeWidth={3} /> : <X size={14} color={colors.textOnDark} strokeWidth={3} />}
    </View>
  );
}

function SourceLink({ label, route }: { label: string; route: string }) {
  return (
    <AnimatedPressable style={styles.sourceRow} onPress={() => router.push(route as never)} hoverEffect accessibilityRole="link" accessibilityLabel={label}>
      <Text style={styles.sourceText} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1 },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  counter: { ...typography.caption, color: colors.textSecondary },
  emptyText: { ...typography.body, color: colors.textSecondary, padding: spacing.md },
  question: { ...typography.h1, color: colors.textPrimary, lineHeight: 28 },
  questionEditorial: { fontFamily: fontFamily.wordmark, fontSize: 22, lineHeight: 30 },
  questionChild: { fontSize: 22, lineHeight: 30 },
  optionList: { gap: spacing.sm },
  optionRow: { flexDirection: 'row' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
  },
  optionHalf: { flex: 1, justifyContent: 'center' },
  optionLarge: { minHeight: 64 },
  optionCorrect: { borderColor: colors.accentGold },
  optionWrong: { borderColor: colors.accentTerracotta },
  optionDim: { opacity: 0.55 },
  optionText: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
  optionTextLarge: { fontSize: 18 },
  imageGrid: { flexDirection: 'row', gap: spacing.sm },
  imageGridLarge: { flexDirection: 'column' },
  imageOption: { flex: 1, aspectRatio: 3 / 4, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent', backgroundColor: colors.surfaceAlt },
  imageOptionLarge: { aspectRatio: 16 / 9, flex: 0, width: '100%' },
  imageFill: { width: '100%', height: '100%' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeInline: {},
  badgeCorner: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  badgeCorrect: { backgroundColor: colors.accentGold },
  badgeWrong: { backgroundColor: colors.accentTerracotta },
  feedback: { padding: spacing.md, borderRadius: radii.xl, gap: spacing.xs, borderWidth: 1 },
  feedbackRight: { backgroundColor: colors.surface, borderColor: 'rgba(232,185,61,0.5)' },
  feedbackWrong: { backgroundColor: colors.surface, borderColor: 'rgba(185,98,47,0.35)' },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  feedbackTitle: { ...typography.bodyBold, color: colors.primary, flex: 1 },
  feedbackTitleWrong: { color: colors.accentTerracotta },
  explanation: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  feedbackActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, gap: spacing.sm },
  learnMore: { ...typography.bodyBold, color: colors.primary },
  nextButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.primary },
  nextText: { ...typography.bodyBold, color: colors.textOnPrimary },
  resultCard: { alignItems: 'center', gap: spacing.xs, padding: spacing.lg, borderRadius: radii.xxl, backgroundColor: colors.surfaceFeature },
  resultEyebrow: { ...typography.overline, color: colors.accentGold },
  resultScore: { ...typography.display, fontFamily: fontFamily.wordmark, fontSize: 30, color: colors.textOnDark, textAlign: 'center' },
  resultBody: { ...typography.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  shareLink: { paddingVertical: spacing.xs },
  shareText: { ...typography.bodyBold, color: colors.accentGold },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
  reviewRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  reviewText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface },
  sourceText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  primary: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.primary, marginTop: spacing.md },
  primaryText: { ...typography.bodyBold, color: colors.textOnPrimary },
});
