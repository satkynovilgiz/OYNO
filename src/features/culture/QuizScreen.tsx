import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, ProgressBar } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { QuizQuestionRow } from '@/services/content/quizService';
import { DAILY_QUIZ_REWARD, QUIZ_PASS_RATIO, useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

type QuizScreenProps = {
  questions: QuizQuestionRow[];
  alreadyClaimedToday: boolean;
  onPressBack: () => void;
};

type Answer = { question_id: string; choice_index: number };

/** Server scores the quiz (claim_daily_quiz) - this screen only tracks the
 * user's picks and renders whatever result comes back, it never computes
 * or displays "correct" locally (there's no correct_index on the client to
 * check against). See the migration's own comment on why. */
export function QuizScreen({ questions, alreadyClaimedToday, onPressBack }: QuizScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; rewarded: boolean } | null>(null);

  const question = questions[step];
  const isLastQuestion = step === questions.length - 1;

  async function handleChoose(choiceIndex: number) {
    const nextAnswers = [...answers, { question_id: question.id, choice_index: choiceIndex }];
    setAnswers(nextAnswers);

    if (!isLastQuestion) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    const outcome = await useProgressStore.getState().claimDailyQuiz(nextAnswers);
    setSubmitting(false);
    setResult(outcome ?? { correct: 0, total: nextAnswers.length, rewarded: false });
  }

  if (alreadyClaimedToday && !result) {
    return (
      <SettingsScreenLayout title={t('culture.quiz.screenTitle')} onPressBack={onPressBack}>
        <View style={styles.centerBlock}>
          <Text style={styles.resultTitle}>{t('culture.quiz.alreadyDoneTitle')}</Text>
          <Text style={styles.resultBody}>{t('culture.quiz.alreadyDoneBody')}</Text>
        </View>
      </SettingsScreenLayout>
    );
  }

  if (result) {
    const passed = result.total > 0 && result.correct / result.total >= QUIZ_PASS_RATIO;
    return (
      <SettingsScreenLayout title={t('culture.quiz.screenTitle')} onPressBack={onPressBack}>
        <View style={styles.centerBlock}>
          <Text style={styles.resultTitle}>
            {passed ? t('culture.quiz.passedTitle') : t('culture.quiz.failedTitle')}
          </Text>
          <Text style={styles.resultScore}>{result.correct} / {result.total}</Text>
          <Text style={styles.resultBody}>
            {result.rewarded
              ? t('culture.quiz.rewardedBody', { xp: DAILY_QUIZ_REWARD.xp, coins: DAILY_QUIZ_REWARD.coins })
              : t('culture.quiz.notRewardedBody')}
          </Text>
        </View>
      </SettingsScreenLayout>
    );
  }

  if (!question) {
    return (
      <SettingsScreenLayout title={t('culture.quiz.screenTitle')} onPressBack={onPressBack}>
        <ActivityIndicator color={colors.primary} />
      </SettingsScreenLayout>
    );
  }

  return (
    <SettingsScreenLayout title={t('culture.quiz.screenTitle')} onPressBack={onPressBack}>
      <ProgressBar progress={(step + (submitting ? 1 : 0)) / questions.length} height={8} />
      <Text style={styles.stepLabel}>
        {t('culture.quiz.stepLabel', { current: step + 1, total: questions.length })}
      </Text>

      <Text style={styles.question}>{question.question}</Text>

      <View style={styles.choices}>
        {question.choices.map((choice, index) => (
          <AnimatedPressable
            key={index}
            style={styles.choice}
            onPress={() => handleChoose(index)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={choice}
          >
            <Text style={styles.choiceText}>{choice}</Text>
          </AnimatedPressable>
        ))}
      </View>

      {submitting && <ActivityIndicator color={colors.primary} />}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stepLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  question: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  choices: {
    gap: spacing.sm,
  },
  choice: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  choiceText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  centerBlock: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  resultTitle: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  resultScore: {
    ...typography.h1,
    color: colors.primary,
  },
  resultBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
