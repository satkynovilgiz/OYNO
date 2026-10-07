import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Lightbulb, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { ownerDetective, useDetectiveStore } from '@/store/useDetectiveStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { buildSession, CLUE_POINTS, isFinished, MAX_CLUES, seededRng, sessionReducer, startSession, summarize, type SessionQuestion, type SessionState } from './detectiveModel';
import { detectiveQuestion, questionArtwork, sourceRoute } from './detectiveQuestions';

type Mode = { kind: 'intro' } | { kind: 'playing'; focus: boolean } | { kind: 'results'; focus: boolean };

/**
 * /culture/detective - identify a cultural object from its bundled picture
 * and up to three clues (all restated from its own article). Fully offline;
 * no timer; scores stay in this mode's own store (not official records).
 */
export function DetectiveScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('culture_detective');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const owner = useRecordsOwner();
  const record = useDetectiveStore((state) => ownerDetective(state.saved, owner));
  const [mode, setMode] = useState<Mode>({ kind: 'intro' });
  const [session, dispatch] = useReducer(
    (state: SessionState, action: Parameters<typeof sessionReducer>[1] | { type: 'start'; questions: SessionQuestion[] }) => (action.type === 'start' ? startSession(action.questions) : sessionReducer(state, action)),
    startSession([]),
  );
  const recorded = useRef(false);

  useEffect(() => {
    void useDetectiveStore.getState().load();
  }, []);

  function begin(focusIds?: string[]) {
    recorded.current = false;
    dispatch({ type: 'start', questions: buildSession(seededRng(Date.now()), focusIds ? { onlyIds: focusIds } : {}) });
    setMode({ kind: 'playing', focus: !!focusIds });
  }

  const finished = mode.kind === 'playing' && session.questions.length > 0 && isFinished(session);
  const summary = useMemo(() => summarize(session), [session]);

  // A finished session is recorded exactly once.
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    useDetectiveStore.getState().recordSession(owner, { score: summary.score, missedIds: summary.missedIds, askedIds: session.questions.map((question) => question.questionId), focus: mode.kind === 'playing' && mode.focus });
    setMode({ kind: 'results', focus: mode.kind === 'playing' && mode.focus });
    announce(t('detective.score', { score: summary.score, max: summary.maxScore }));
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (sourceId: string) => t(`detective.names.${sourceId}`);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('detective.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {mode.kind === 'intro' ? (
          <View style={styles.stack} testID="detective-intro">
            <Search size={28} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.body, large && styles.bodyLarge]}>{t('detective.intro')}</Text>
            <Text style={styles.meta}>{t('detective.scoring')}</Text>
            {record.sessions > 0 ? <Text style={styles.meta}>{t('detective.best', { score: record.bestScore })}</Text> : null}
            <Button label={t('detective.start')} size="lg" onPress={() => begin()} testID="detective-start" />
            {record.lastMissedIds.length > 0 ? <Button label={t('detective.focusMissed')} variant="secondary" onPress={() => begin(record.lastMissedIds)} testID="detective-focus" /> : null}
            <Text style={styles.meta}>{t('detective.separateNote')}</Text>
          </View>
        ) : null}

        {mode.kind === 'playing' && !finished && session.questions[session.index] ? (
          <QuestionView key={session.index} state={session} large={large} name={name} onReveal={() => dispatch({ type: 'reveal' })} onAnswer={(optionId) => dispatch({ type: 'answer', optionId })} onNext={() => dispatch({ type: 'next' })} />
        ) : null}

        {mode.kind === 'results' ? (
          <View style={styles.stack} testID="detective-results">
            <Text style={styles.heading} accessibilityRole="header">
              {t('detective.resultsTitle')}
            </Text>
            <Text style={[styles.body, styles.bold]} testID="detective-score">
              {t('detective.score', { score: summary.score, max: summary.maxScore })}
            </Text>
            <Text style={styles.body}>{t('detective.correctCount', { correct: summary.correct, total: summary.total })}</Text>
            <Text style={styles.meta}>{t('detective.cluesUsed', { count: summary.cluesUsed })}</Text>
            <Text style={styles.meta}>{t('detective.best', { score: record.bestScore })}</Text>
            {summary.missedIds.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('detective.missedTitle')}</Text>
                {summary.missedIds.map((id) => {
                  const question = detectiveQuestion(id);
                  if (!question) return null;
                  return (
                    <AnimatedPressable key={id} style={styles.missedRow} onPress={() => router.push(sourceRoute(question) as never)} accessibilityRole="link" accessibilityLabel={`${name(question.sourceId)}. ${t('detective.readArticle')}`}>
                      <Text style={[styles.body, { flex: 1 }]}>{name(question.sourceId)}</Text>
                      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                    </AnimatedPressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.body}>{t('detective.allFound')}</Text>
            )}
            <Button label={t('detective.replay')} size="lg" onPress={() => begin()} testID="detective-replay" />
            {summary.missedIds.length > 0 ? <Button label={t('detective.focusMissed')} variant="secondary" onPress={() => begin(summary.missedIds)} testID="detective-focus" /> : null}
            <Button label={t('detective.back')} variant="text" onPress={onPressBack} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function QuestionView({ state, large, name, onReveal, onAnswer, onNext }: { state: SessionState; large: boolean; name: (sourceId: string) => string; onReveal: () => void; onAnswer: (optionId: string) => void; onNext: () => void }) {
  const { t } = useTranslation();
  const current = state.questions[state.index];
  const question = detectiveQuestion(current.questionId)!;
  const artwork = questionArtwork(question);
  const answer = state.showingAnswer ? state.answers[state.answers.length - 1] : null;
  const last = state.index === state.questions.length - 1;

  useEffect(() => {
    if (!answer) return;
    announce(`${answer.correct ? t('detective.correct') : t('detective.notQuite')} ${t('detective.itWas', { name: name(current.sourceId) })}`);
  }, [answer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.stack} testID="detective-question">
      <Text style={styles.meta} testID="detective-progress">
        {t('detective.questionOf', { current: state.index + 1, total: state.questions.length })}
      </Text>
      {artwork ? (
        // The label never names the object - that would give the answer away.
        <Image source={artwork} style={[styles.artwork, large && styles.artworkLarge]} resizeMode="cover" accessibilityLabel={t('detective.artworkA11y')} testID="detective-artwork" />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.meta}>{t('detective.noImage')}</Text>
        </View>
      )}

      {Array.from({ length: state.revealed }, (_, index) => (
        <View key={index} style={styles.clue} testID={`detective-clue-${index + 1}`}>
          <Lightbulb size={16} color={colors.accentTerracotta} strokeWidth={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.clueLabel}>{t('detective.clueLabel', { number: index + 1 })}</Text>
            <Text style={[styles.body, large && styles.bodyLarge]}>{t(`detective.questions.${question.id}.clue${index + 1}`)}</Text>
          </View>
        </View>
      ))}
      {!answer ? (
        <View style={styles.revealRow}>
          <Button label={state.revealed >= MAX_CLUES ? t('detective.noMoreClues') : t('detective.revealClue')} variant="secondary" size="sm" onPress={onReveal} disabled={state.revealed >= MAX_CLUES} testID="detective-reveal" />
          <Text style={styles.meta}>{t('detective.pointsIfCorrect', { points: CLUE_POINTS[state.revealed] })}</Text>
        </View>
      ) : null}

      <Text style={styles.heading}>{t('detective.question')}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {current.options.map((optionId) => {
          const isCorrect = optionId === current.sourceId;
          const chosen = answer?.chosen === optionId;
          return (
            <AnimatedPressable
              key={optionId}
              style={[styles.option, large && styles.optionLarge, answer && isCorrect && styles.optionCorrect, chosen && !isCorrect && styles.optionWrong]}
              onPress={() => onAnswer(optionId)}
              disabled={!!answer}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen, disabled: !!answer }}
              aria-checked={chosen}
              accessibilityLabel={t('detective.optionA11y', { name: name(optionId) })}
              testID={`detective-option-${optionId}`}
            >
              <Text style={[styles.optionText, large && styles.bodyLarge]}>{name(optionId)}</Text>
              {answer && isCorrect ? <Check size={18} color={colors.primary} strokeWidth={2.5} /> : null}
              {chosen && !isCorrect ? <X size={18} color={colors.accentTerracotta} strokeWidth={2.5} /> : null}
            </AnimatedPressable>
          );
        })}
      </View>

      {answer ? (
        <View style={styles.card} testID="detective-feedback">
          <Text style={styles.cardTitle}>{answer.correct ? t('detective.correct') : t('detective.notQuite')}</Text>
          <Text style={styles.body}>{t('detective.itWas', { name: name(current.sourceId) })}</Text>
          {!answer.correct ? <Text style={styles.meta}>{t('detective.yourAnswer', { name: name(answer.chosen) })}</Text> : null}
          <Text style={styles.meta}>{t('detective.pointsEarned', { points: answer.points })}</Text>
          <Text style={[styles.body, large && styles.bodyLarge]}>{t(`detective.questions.${question.id}.explanation`)}</Text>
          <AnimatedPressable style={styles.link} onPress={() => router.push(sourceRoute(question) as never)} accessibilityRole="link" accessibilityLabel={`${t('detective.readArticle')}: ${name(current.sourceId)}`} testID="detective-read-article">
            <Text style={styles.linkText}>{t('detective.readArticle')}</Text>
            <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
          </AnimatedPressable>
          <Button label={last ? t('detective.seeResults') : t('detective.next')} onPress={onNext} testID="detective-next" />
        </View>
      ) : null}
    </View>
  );
}

/** Culture entry row. */
export function DetectiveEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entryRow} onPress={() => router.push('/culture/detective' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('detective.title')}. ${t('detective.entryMeta')}`} testID="detective-entry">
      <Search size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{t('detective.title')}</Text>
        <Text style={styles.meta}>{t('detective.entryMeta')}</Text>
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 27 },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  artwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted },
  artworkLarge: { aspectRatio: 1 },
  noImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  clue: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  clueLabel: { ...textStyles.overline, color: colors.primary },
  revealRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  options: { gap: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle },
  optionLarge: { minHeight: 64 },
  optionCorrect: { borderColor: colors.primary },
  optionWrong: { borderColor: colors.accentTerracotta },
  optionText: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  missedRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
