import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, radii, spacing, textStyles } from '@/theme';

import { percentRead } from './readingModel';
import type { ReadingTracker } from './useReadingTracker';

/** Quiet reading UI: a thin progress line at the very top and, for an
 * unfinished article, the "Continue where you left off?" choice. */
export function ReadingOverlay({ tracker, experience }: { tracker: ReadingTracker; experience: AgeExperience }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isChild = experience === 'child';
  const ratio = tracker.ratio ?? 0;
  return (
    <>
      {tracker.ratio !== null && ratio > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.bar, { top: insets.top, height: isChild ? 4 : 2 }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('reading.progress')}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
        >
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}
      {tracker.promptVisible && tracker.record ? (
        <View style={[styles.prompt, { bottom: insets.bottom + spacing.md }]} accessibilityLiveRegion="polite">
          <Text style={[styles.promptTitle, isChild && styles.promptTitleChild]}>{isChild ? t('reading.resumeChild') : t('reading.resumeQuestion')}</Text>
          {!isChild ? <Text style={styles.promptMeta}>{t('reading.percentRead', { percent: percentRead(tracker.record) })}</Text> : null}
          <View style={styles.promptActions}>
            <Button label={t('reading.continue')} size="sm" onPress={tracker.resume} />
            <Button label={t('reading.fromBeginning')} variant="secondary" size="sm" onPress={tracker.startFromTop} />
          </View>
        </View>
      ) : null}
    </>
  );
}

/** Mark as read / Start over, in the article's existing actions area. */
export function ReadingActions({ tracker }: { tracker: ReadingTracker }) {
  const { t } = useTranslation();
  const completed = !!tracker.record?.completedAt;
  return (
    <View style={styles.actions}>
      {completed ? <Text style={styles.completed}>✓ {t('reading.completed')}</Text> : null}
      {!completed ? (
        <AnimatedPressable style={styles.link} onPress={tracker.markRead} accessibilityRole="button" accessibilityLabel={t('reading.markRead')}>
          <Text style={styles.linkText}>{t('reading.markRead')}</Text>
        </AnimatedPressable>
      ) : null}
      {tracker.record ? (
        <AnimatedPressable style={styles.link} onPress={tracker.startOver} accessibilityRole="button" accessibilityLabel={t('reading.startOver')}>
          <Text style={styles.linkText}>{t('reading.startOver')}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.04)', zIndex: 20 },
  fill: { height: '100%', backgroundColor: colors.accentGold },
  prompt: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, zIndex: 30, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  promptTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  promptTitleChild: { fontSize: 18 },
  promptMeta: { ...textStyles.small, color: colors.textSecondary },
  promptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  completed: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { ...textStyles.small, fontWeight: '700', color: colors.primary, textDecorationLine: 'underline' },
});
