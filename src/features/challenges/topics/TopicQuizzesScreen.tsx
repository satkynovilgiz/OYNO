import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useChallengeStore } from '@/store/useChallengeStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { CHILD_TOPIC_QUESTIONS, TOPIC_QUIZZES, topicResultKey, topicRoute } from './topicQuizzes';

/** /culture/quizzes - the curated Culture Topic Quizzes (bundled; offline). */
export function TopicQuizzesScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('topic_quizzes');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const results = useChallengeStore((state) => state.results);
  useEffect(() => {
    if (!useChallengeStore.getState().isLoaded) void useChallengeStore.getState().load();
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('topicQuiz.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.intro}>{t('topicQuiz.intro')}</Text>
        {TOPIC_QUIZZES.map((topic) => {
          const count = experience === 'child' ? Math.min(CHILD_TOPIC_QUESTIONS, topic.questions.length) : topic.questions.length;
          const result = results[topicResultKey(topic.id)];
          const last = result?.completedAt ? t('topicQuiz.lastResult', { correct: result.lastCorrect, total: result.lastTotal }) : null;
          const image = cultureItemImages[topic.heroItemId]?.[0];
          const meta = [t('challenges.questionCount', { count }), last].filter(Boolean).join(' · ');
          return (
            <AnimatedPressable
              key={topic.id}
              style={[styles.card, experience === 'adult' && styles.cardCompact]}
              onPress={() => router.push(topicRoute(topic.id) as never)}
              accessibilityRole="button"
              accessibilityLabel={`${t(topic.titleKey)}. ${t(topic.descriptionKey)}. ${meta}`}
            >
              {image && experience !== 'adult' ? <Image source={image} style={[styles.thumb, experience === 'child' && styles.thumbLarge]} resizeMode="cover" /> : <GraduationCap size={20} color={colors.primary} strokeWidth={2} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle}>{t(topic.titleKey)}</Text>
                {experience === 'adult' ? null : <Text style={styles.meta}>{t(topic.descriptionKey)}</Text>}
                <Text style={styles.meta}>{meta}</Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Culture entry row. */
export function TopicQuizzesEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entryRow} onPress={() => router.push('/culture/quizzes' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('topicQuiz.title')}. ${t('topicQuiz.entryMeta')}`}>
      <GraduationCap size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{t('topicQuiz.title')}</Text>
        <Text style={styles.meta}>{t('topicQuiz.entryMeta')}</Text>
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  intro: { ...textStyles.body, color: colors.textSecondary, marginBottom: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardCompact: { paddingVertical: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbLarge: { width: 72, height: 72 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
