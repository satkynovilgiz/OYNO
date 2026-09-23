import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { collections } from '@/features/collections/collectionsData';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { CHILD_DAILY_QUESTION_COUNT, collectionQuestionIds, DAILY_QUESTION_COUNT, journeyQuestionIds } from './challengeLogic';

/** Knowledge Challenges hub (/challenges): today's Daily Challenge, one
 * Culture Challenge per collection, and the Journey Challenge built from
 * what the user has actually explored. */
export function ChallengesHubScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('challenges');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const results = useChallengeStore((state) => state.results);
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);

  useEffect(() => {
    if (!useChallengeStore.getState().isLoaded) void useChallengeStore.getState().load();
  }, []);

  const today = localDateKey();
  const todayResult = results[`daily:${today}`];
  const dailyCount = experience === 'child' ? CHILD_DAILY_QUESTION_COUNT : DAILY_QUESTION_COUNT;
  const journeyCount = journeyQuestionIds(visitedRegionIds, Object.values(dailyCompletions)).length;
  const journeyResult = results.journey;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('challenges.title')}</Text>
          <Text style={styles.subtitle}>{t('challenges.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <AnimatedPressable
          style={styles.daily}
          onPress={() => router.push('/challenges/daily' as never)}
          pressScale={0.98}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={`${t('challenges.daily.title')}. ${
            todayResult?.completedAt ? t('challenges.doneToday', { correct: todayResult.lastCorrect, total: todayResult.lastTotal }) : t('challenges.daily.description', { count: dailyCount })
          }`}
        >
          <View style={styles.dailyTop}>
            <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.dailyEyebrow}>{t('challenges.daily.title')}</Text>
          </View>
          <Text style={styles.dailyTitle}>
            {todayResult?.completedAt ? t('challenges.doneToday', { correct: todayResult.lastCorrect, total: todayResult.lastTotal }) : t('challenges.daily.description', { count: dailyCount })}
          </Text>
          <View style={styles.dailyCta}>
            <Text style={styles.dailyCtaText}>{todayResult?.completedAt ? t('challenges.retry') : t('challenges.start')}</Text>
            <ChevronRight size={16} color={colors.textPrimary} strokeWidth={2.5} />
          </View>
        </AnimatedPressable>

        <Text style={styles.sectionTitle}>{t('challenges.culture.title')}</Text>
        {collections.map((collection) => {
          const count = collectionQuestionIds(collection).length;
          if (count === 0) return null;
          const result = results[`collection:${collection.id}`];
          const title = collection.title[language] ?? collection.title.kg;
          return (
            <AnimatedPressable
              key={collection.id}
              style={styles.row}
              onPress={() => router.push(`/challenges/collection-${collection.id}` as never)}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${result?.completedAt ? t('challenges.best', { correct: result.bestCorrect, total: result.lastTotal }) : t('challenges.questionCount', { count })}`}
            >
              <Image source={collection.heroImage} style={styles.thumb} resizeMode="cover" />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, experience === 'adult' && styles.editorial]} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.rowMeta}>
                  {result?.completedAt ? t('challenges.best', { correct: result.bestCorrect, total: result.lastTotal }) : t('challenges.questionCount', { count })}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          );
        })}

        <Text style={styles.sectionTitle}>{t('challenges.journey.title')}</Text>
        {journeyCount > 0 ? (
          <AnimatedPressable
            style={styles.row}
            onPress={() => router.push('/challenges/journey' as never)}
            hoverEffect
            accessibilityRole="button"
            accessibilityLabel={`${t('challenges.journey.title')}. ${t('challenges.journey.description')}`}
          >
            <View style={[styles.thumb, styles.thumbIcon]}>
              <Sparkles size={22} color={colors.accentGold} strokeWidth={1.75} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('challenges.journey.description')}</Text>
              <Text style={styles.rowMeta}>
                {journeyResult?.completedAt ? t('challenges.best', { correct: journeyResult.bestCorrect, total: journeyResult.lastTotal }) : t('challenges.questionCount', { count: journeyCount })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </AnimatedPressable>
        ) : (
          <View style={[styles.row, styles.locked]}>
            <View style={[styles.thumb, styles.thumbLocked]}>
              <Lock size={20} color={colors.textMuted} strokeWidth={2} />
            </View>
            <Text style={[styles.rowMeta, styles.rowText]}>{t('challenges.journey.locked')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  headerText: { flex: 1 },
  title: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  daily: { padding: spacing.lg, borderRadius: radii.xxl, backgroundColor: colors.surfaceFeature, gap: spacing.xs },
  dailyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dailyEyebrow: { ...typography.overline, color: colors.accentGold },
  dailyTitle: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textOnDark },
  dailyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
  },
  dailyCtaText: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surface },
  locked: { opacity: 0.85 },
  thumb: { width: 56, height: 56, borderRadius: radii.lg },
  thumbIcon: { backgroundColor: colors.surfaceFeature, alignItems: 'center', justifyContent: 'center' },
  thumbLocked: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  editorial: { fontFamily: fontFamily.wordmark },
  rowMeta: { ...typography.small, fontWeight: '500', color: colors.textSecondary },
});
