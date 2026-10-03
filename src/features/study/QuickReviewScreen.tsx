import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { ChallengeRunScreen } from '@/features/challenges/ChallengeRunScreen';
import { GlossaryStudyScreen } from '@/features/culture/glossary/study/GlossaryStudyScreen';
import { colors, spacing, textStyles, typography } from '@/theme';

import { QUICK_REVIEW_PER_SOURCE, quickReviewPlan } from './studyQueue';
import { useStudyQueueInput } from './useStudyQueue';

type Phase = 'mistakes' | 'glossary' | 'done';

/**
 * /study/quick - up to 3 challenge mistakes, then up to 3 glossary cards.
 * It REUSES Challenge Review and the Glossary flashcards as they are, so a
 * corrected question leaves the mistake queue and "Got it" updates the
 * glossary state exactly as on their own screens. No articles here.
 */
export function QuickReviewScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { input, ready } = useStudyQueueInput();
  // The plan is fixed when it is first known (like any session).
  const [phase, setPhase] = useState<Phase | null>(null);
  const plan = quickReviewPlan(input);
  const backToStudy = () => (router.canGoBack() ? router.back() : router.replace('/study' as never));

  if (phase === null && ready) {
    const first: Phase = plan.mistakeIds.length > 0 ? 'mistakes' : plan.glossaryIds.length > 0 ? 'glossary' : 'done';
    setPhase(first);
  }

  if (phase === 'mistakes') {
    const nextIsGlossary = plan.glossaryIds.length > 0;
    return (
      <ChallengeRunScreen
        challengeId="review"
        onPressBack={onPressBack}
        quick={{ limit: QUICK_REVIEW_PER_SOURCE, nextLabel: nextIsGlossary ? t('study.quickNextTerms') : t('study.backToStudy'), onNext: () => (nextIsGlossary ? setPhase('glossary') : backToStudy()) }}
      />
    );
  }
  if (phase === 'glossary') {
    return <GlossaryStudyScreen mode="review" limit={QUICK_REVIEW_PER_SOURCE} onPressBack={onPressBack} onDone={{ label: t('study.backToStudy'), run: backToStudy }} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          {t('study.quickReview')}
        </Text>
      </View>
      <View style={styles.center}>
        {phase === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.heading}>{t('study.caughtUp')}</Text>
            <Text style={styles.meta}>{t('study.caughtUpBody')}</Text>
            <Button label={t('study.backToStudy')} variant="secondary" onPress={backToStudy} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  heading: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  meta: { ...textStyles.small, color: colors.textSecondary, textAlign: 'center' },
});
