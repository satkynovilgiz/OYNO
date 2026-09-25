import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Image, type ImageSourcePropType, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, IconButton, ProgressBar, sourceWidth } from '@/components/ui';
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
import { cardRadii, colors, editorial, fontFamily, radii, spacing, textStyles, typography } from '@/theme';

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
    const perfect = total > 0 && correct === total;
    const resultMessage = perfect ? t('challenges.v2.perfectBody') : correct / Math.max(1, total) >= 0.6 ? t('challenges.v2.goodBody') : t('challenges.v2.lowerBody');
    const shareImage = collection?.heroImage ?? imageFor(questions[0].sourceType === 'destination' ? { type: 'destination', id: questions[0].sourceId } : { type: 'culture_item', id: questions[0].sourceId }) ?? null;
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.header}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          </View>
          <View style={styles.resultCard} accessible accessibilityLabel={`${title}. ${t('challenges.resultTitle', { correct, total })}. ${resultMessage}`}>
            <View style={styles.resultOrnaments}>
              {perfect ? <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} /> : null}
              <OymoOrnament size={perfect ? 22 : 16} color={colors.accentGold} strokeWidth={1.5} />
              {perfect ? <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} /> : null}
            </View>
            <Text style={styles.resultEyebrow} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.resultScore}>
              {correct}
              <Text style={styles.resultScoreTotal}> / {total}</Text>
            </Text>
            {perfect ? <Text style={styles.resultPerfect}>{t('challenges.v2.perfectTitle')}</Text> : null}
            <Text style={styles.resultBody}>{resultMessage}</Text>
            <View style={styles.resultActions}>
              <Button
                label={t('share.action')}
                variant="accent"
                size="sm"
                onPress={() =>
                  void share({ title, label: t('challenges.shareTitle'), imageSource: shareImage, variant: 'score', stat: `${correct} / ${total}` }, `${t('challenges.shareTitle')}: ${correct} / ${total}`)
                }
              />
            </View>
          </View>

          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('challenges.v2.reviewTitle')}
          </Text>
          {questions.map((question, questionIndex) => {
            const answer = answers.find((a) => a.questionId === question.id);
            const chosen = question.options.find((option) => option.id === answer?.optionId);
            const right = question.options.find((option) => option.id === question.correctOptionId)!;
            const ok = chosen?.id === right.id;
            return (
              <View key={question.id} style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <StateBadge correct={ok} inline />
                  <Text style={styles.reviewQuestion}>{t(`challenges.questions.${question.id}.question`)}</Text>
                </View>
                {question.kind === 'image' ? null : (
                  <View style={styles.reviewAnswers}>
                    {!ok && chosen ? (
                      <Text style={styles.reviewLine}>
                        <Text style={styles.reviewLabel}>{t('challenges.v2.yourAnswer')}: </Text>
                        {optionLabel(question, chosen, question.options.indexOf(chosen))}
                      </Text>
                    ) : null}
                    <Text style={styles.reviewLine}>
                      <Text style={styles.reviewLabel}>{t('challenges.v2.correctAnswer')}: </Text>
                      {optionLabel(question, right, question.options.indexOf(right))}
                    </Text>
                  </View>
                )}
                <Text style={styles.reviewExplanation} numberOfLines={experience === 'child' ? 3 : undefined}>
                  {t(`challenges.questions.${question.id}.explanation`)}
                </Text>
                <AnimatedPressable
                  onPress={() => router.push(routeForSource(question) as never)}
                  hitSlop={8}
                  press="strong"
                  accessibilityRole="link"
                  accessibilityLabel={`${t('challenges.learnMore')}: ${sourceTitle(question)}`}
                  accessibilityHint={`${questionIndex + 1} / ${questions.length}`}
                >
                  <Text style={styles.learnMore}>
                    {t('challenges.learnMore')} · {sourceTitle(question)} →
                  </Text>
                </AnimatedPressable>
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

          <View style={styles.primary}>
            <Button label={t('challenges.backToChallenges')} variant="secondary" size="lg" block onPress={() => router.replace('/challenges' as never)} />
          </View>
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
    // Success tap only for a correct answer - never an "error" buzz.
    if (optionId === question.correctOptionId && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function next() {
    if (index + 1 >= questions.length) {
      const score = scoreAnswers(answers);
      useChallengeStore.getState().complete(resultKey, score.correct, score.total);
      if (score.total > 0 && score.correct === score.total && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          <Text style={styles.kicker} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.counter} accessibilityLabel={t('challenges.questionOf', { index: index + 1, total: questions.length })}>
            {index + 1} / {questions.length}
          </Text>
        </View>
        <ProgressBar progress={(index + (answered ? 1 : 0)) / questions.length} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />

        <Text style={[styles.question, isAdult && styles.questionEditorial, experience === 'child' && styles.questionChild]} accessibilityRole="header">
          {t(`challenges.questions.${question.id}.question`)}
        </Text>

        <Options question={question} experience={experience} selected={selected} onChoose={choose} labelFor={(option, position) => optionLabel(question, option, position)} />

        {answered ? (
          <View style={[styles.feedback, isCorrect ? styles.feedbackRight : styles.feedbackWrong]} accessibilityLiveRegion="polite">
            <View style={styles.feedbackHeader}>
              <View style={[styles.feedbackIcon, isCorrect ? styles.badgeCorrect : styles.feedbackIconSoft]}>
                {isCorrect ? <Check size={14} color={colors.textPrimary} strokeWidth={3} /> : <OymoOrnament size={12} color={colors.accentTerracotta} strokeWidth={1.75} />}
              </View>
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
              <Button label={index + 1 >= questions.length ? t('challenges.finish') : t('challenges.next')} variant="primary" onPress={next} />
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
              {image ? (
                // Small motif art (e.g. a 114 px oymo pattern) is shown whole
                // on cream instead of being cropped and upscaled.
                (sourceWidth(image) ?? 1000) < 400 ? (
                  <View style={styles.motifFrame}>
                    <Image source={image} style={styles.motif} resizeMode="contain" />
                  </View>
                ) : (
                  <Image source={image} style={styles.imageFill} resizeMode="cover" />
                )
              ) : null}
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
  kicker: { ...textStyles.overline, color: colors.accentTerracotta, flex: 1 },
  counter: { ...textStyles.title, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textSecondary, padding: spacing.md },
  question: { ...textStyles.h2, color: colors.textPrimary, marginTop: spacing.xs },
  questionEditorial: { ...editorial(textStyles.h2) },
  questionChild: { ...textStyles.h1 },
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
    borderRadius: cardRadii.compact,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceElevated,
  },
  optionHalf: { flex: 1, justifyContent: 'center' },
  optionLarge: { minHeight: 64 },
  // Correct: gold edge + soft success surface + ✓ badge.
  optionCorrect: { borderColor: colors.accentGold, backgroundColor: 'rgba(232,185,61,0.14)' },
  // Incorrect: calm terracotta edge + ✕ badge (no harsh red fill).
  optionWrong: { borderColor: colors.accentTerracotta, backgroundColor: 'rgba(185,98,47,0.07)' },
  optionDim: { opacity: 0.55 },
  optionText: { ...textStyles.bodyMedium, fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  optionTextLarge: { fontSize: 18 },
  // Two columns (3 options -> 2 + 1), never three squeezed into a row.
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageGridLarge: {},
  imageOption: { flexBasis: '47%', flexGrow: 0, aspectRatio: 4 / 3, borderRadius: cardRadii.compact, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent', backgroundColor: colors.surfaceMuted },
  // Child/preteen: same 2-column grid, slightly taller tiles (bigger target).
  imageOptionLarge: { aspectRatio: 1 },
  imageFill: { width: '100%', height: '100%' },
  motifFrame: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, padding: spacing.md },
  motif: { width: '70%', height: '70%' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeInline: {},
  badgeCorner: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  badgeCorrect: { backgroundColor: colors.accentGold },
  badgeWrong: { backgroundColor: colors.accentTerracotta },
  feedback: { padding: spacing.md, borderRadius: cardRadii.media, gap: spacing.xs, backgroundColor: colors.surfaceElevated },
  feedbackRight: {},
  feedbackWrong: {},
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  feedbackTitle: { ...textStyles.title, color: colors.primary, flex: 1 },
  feedbackIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  feedbackIconSoft: { backgroundColor: 'rgba(185,98,47,0.12)' },
  feedbackTitleWrong: { color: colors.accentTerracotta },
  explanation: { ...textStyles.body, fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  feedbackActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, gap: spacing.sm },
  learnMore: { ...textStyles.caption, fontSize: 14, fontWeight: '700', color: colors.primary, paddingLeft: 0 },
  nextButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.primary },
  nextText: { ...typography.bodyBold, color: colors.textOnPrimary },
  resultCard: { alignItems: 'center', gap: spacing.xs, padding: spacing.lg, borderRadius: cardRadii.hero, backgroundColor: colors.surfaceFeature },
  resultOrnaments: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resultScoreTotal: { ...textStyles.h2, color: colors.textOnDarkSecondary },
  resultPerfect: { ...textStyles.title, color: colors.accentGold },
  resultActions: { marginTop: spacing.xs },
  reviewCard: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewQuestion: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  reviewAnswers: { gap: 2, paddingLeft: 24 + spacing.sm },
  reviewLine: { ...textStyles.caption, color: colors.textPrimary },
  reviewLabel: { ...textStyles.caption, fontWeight: '700', color: colors.textSecondary },
  reviewExplanation: { ...textStyles.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary, paddingLeft: 24 + spacing.sm },
  resultEyebrow: { ...typography.overline, color: colors.accentGold },
  resultScore: { ...editorial(textStyles.display), fontSize: 48, lineHeight: 54, color: colors.textOnDark, textAlign: 'center' },
  resultBody: { ...textStyles.body, color: colors.textOnDarkSecondary, textAlign: 'center', maxWidth: 300 },
  shareLink: { paddingVertical: spacing.xs },
  shareText: { ...typography.bodyBold, color: colors.accentGold },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
  reviewRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  reviewText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface },
  sourceText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  primary: { marginTop: spacing.md },
  primaryText: { ...typography.bodyBold, color: colors.textOnPrimary },
});
