import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { QuizScreen } from '@/features/culture/QuizScreen';
import { useQuizQuestions } from '@/services/content/quizService';
import { useProgressStore } from '@/store/useProgressStore';
import { colors } from '@/theme';

function isToday(dateISO: string | null): boolean {
  if (!dateISO) return false;
  return dateISO === new Date().toISOString().slice(0, 10);
}

export default function CultureQuizRoute() {
  const { t } = useTranslation();
  const { data: questions, isLoading, error } = useQuizQuestions();
  const quizClaimedDateISO = useProgressStore((state) => state.quizClaimedDateISO);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !questions?.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('culture.loadError')}</Text>
      </View>
    );
  }

  return (
    <QuizScreen
      questions={questions}
      alreadyClaimedToday={isToday(quizClaimedDateISO)}
      onPressBack={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  message: {
    color: colors.textSecondary,
  },
});
