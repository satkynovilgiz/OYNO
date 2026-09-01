import { ChevronLeft, PartyPopper } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/avatar';
import { AnimatedPressable, Button, Card, ProgressBar } from '@/components/ui';
import { komuzTracks } from '@/features/culture/audioData';
import { KomuzPlaylist } from '@/features/culture/components';
import { track } from '@/services/analytics/analytics';
import { useCultureItem } from '@/services/content/cultureItemsService';
import { KOMUZ_LESSON_STEPS, clampStepIndex, isLastStep, scoreQuiz, type QuizAnswer } from '@/services/culture/komuzLesson';
import { useAppStore } from '@/store/useAppStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { KOMUZ_LESSON_REWARD, useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { KomuzInstrumentIllustration } from './components/KomuzInstrumentIllustration';
import { KOMUZ_QUIZ_QUESTIONS } from './quizQuestions';

type KomuzLearnScreenProps = {
  onPressBack: () => void;
};

export function KomuzLearnScreen({ onPressBack }: KomuzLearnScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: item, isLoading } = useCultureItem('komuz-overview');
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number; passed: boolean } | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    track('komuz_lesson_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = KOMUZ_LESSON_STEPS[stepIndex];

  function handleAnswer(questionId: string, choiceIndex: number) {
    setAnswers((prev) => {
      const next = prev.filter((a) => a.questionId !== questionId);
      next.push({ questionId, choiceIndex });
      return next;
    });
  }

  function handleNext() {
    if (step.id === 'quiz') {
      const result = scoreQuiz(answers, KOMUZ_QUIZ_QUESTIONS);
      setQuizResult(result);
      if (result.passed) {
        setCompleted(true);
        track('komuz_lesson_completed');
        void useProgressStore.getState().completeKomuzLesson();
      }
      return;
    }
    setStepIndex((current) => clampStepIndex(current + 1));
  }

  function handleRetryQuiz() {
    setAnswers([]);
    setQuizResult(null);
  }

  if (completed) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.completionContent, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.completionIconWrap}>
            <PartyPopper size={40} color={colors.accentGoldPressed} strokeWidth={2} />
          </View>
          <Text style={styles.completionTitle}>{t('culture.komuz.completion.title')}</Text>
          <UserAvatar characterId={characterId} avatarConfig={avatarConfig} size="large" />
          <Text style={styles.completionReward}>{t('culture.komuz.completion.reward', { xp: KOMUZ_LESSON_REWARD.xp })}</Text>
          <Button label={t('culture.bozUy.completion.continue')} onPress={onPressBack} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable onPress={onPressBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} haptic="light">
          <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t('culture.komuz.title')}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ProgressBar progress={(stepIndex + 1) / KOMUZ_LESSON_STEPS.length} height={8} />
      <Text style={styles.stepLabel}>{t('culture.komuz.stepLabel', { current: stepIndex + 1, total: KOMUZ_LESSON_STEPS.length })}</Text>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {step.id === 'introduction' && (
              <Card style={styles.textCard}>
                <Text style={styles.cardTitle}>{t('culture.komuz.steps.introduction.title')}</Text>
                <Text style={styles.cardBody}>{item?.history ?? t('culture.item.pendingResearch')}</Text>
              </Card>
            )}

            {step.id === 'parts' && (
              <Card style={styles.textCard}>
                <Text style={styles.cardTitle}>{t('culture.komuz.steps.parts.title')}</Text>
                <Text style={styles.cardBody}>{item?.objects_used ?? t('culture.item.pendingResearch')}</Text>
              </Card>
            )}

            {step.id === 'strings' && (
              <View style={styles.stringsSection}>
                <Text style={styles.cardTitle}>{t('culture.komuz.steps.strings.title')}</Text>
                <Text style={styles.hint}>{t('culture.komuz.steps.strings.hint')}</Text>
                <KomuzInstrumentIllustration />
                <Text style={styles.cardTitle}>{t('culture.komuz.steps.strings.melodiesTitle')}</Text>
                <KomuzPlaylist tracks={komuzTracks} />
              </View>
            )}

            {step.id === 'quiz' && (
              <View style={styles.quizSection}>
                <Text style={styles.cardTitle}>{t('culture.komuz.steps.quiz.title')}</Text>
                {KOMUZ_QUIZ_QUESTIONS.map((question) => (
                  <Card key={question.id} style={styles.textCard}>
                    <Text style={styles.cardBody}>{t(question.questionKey)}</Text>
                    <View style={styles.choices}>
                      {(t(question.choicesKey, { returnObjects: true }) as string[]).map((choice, index) => {
                        const isSelected = answers.find((a) => a.questionId === question.id)?.choiceIndex === index;
                        return (
                          <AnimatedPressable
                            key={index}
                            style={[styles.choice, isSelected && styles.choiceSelected]}
                            onPress={() => handleAnswer(question.id, index)}
                            accessibilityRole="button"
                            accessibilityLabel={choice}
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  </Card>
                ))}

                {quizResult && !quizResult.passed && (
                  <Card style={styles.textCard}>
                    <Text style={styles.cardBody}>
                      {t('culture.komuz.quiz.failed', { correct: quizResult.correct, total: quizResult.total })}
                    </Text>
                    <Button label={t('culture.komuz.quiz.retry')} variant="secondary" onPress={handleRetryQuiz} />
                  </Card>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={isLastStep(stepIndex) ? t('culture.komuz.finish') : t('culture.bozUy.next')}
          onPress={handleNext}
          disabled={step.id === 'quiz' && answers.length < KOMUZ_QUIZ_QUESTIONS.length}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  textCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  stringsSection: {
    gap: spacing.md,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  quizSection: {
    gap: spacing.md,
  },
  choices: {
    gap: spacing.xs,
  },
  choice: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  choiceText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  choiceTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  completionContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  completionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  completionReward: {
    ...typography.h2,
    color: colors.accentGoldPressed,
  },
});
