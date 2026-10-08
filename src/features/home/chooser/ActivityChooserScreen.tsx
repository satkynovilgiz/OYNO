import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { chooseActivities, explanationKey, INTERESTS, TIME_BUDGETS, type Activity, type Interest, type Suggestion, type TimeBudget } from './activityChooser';
import { useActivityChooserSignals } from './useActivityChooser';

/**
 * /activities - "Find something to do": choose 2/5/10 minutes and an
 * interest, get up to three real activities (activityChooser.ts has the
 * rules). The choice lives only in this screen's state: not stored, not
 * sent, no account needed.
 */
export function ActivityChooserScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const signals = useActivityChooserSignals();
  const [minutes, setMinutes] = useState<TimeBudget | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [page, setPage] = useState(0);
  const result = minutes && interest ? chooseActivities(minutes, interest, signals, page) : null;

  const titleOf = (activity: Activity) => activity.title ?? t(activity.titleKey!);
  const radio = <T extends string | number>(heading: string, options: readonly T[], selected: T | null, labelOf: (option: T) => string, onSelect: (option: T) => void, id: string) => (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={heading}>
        {options.map((option) => {
          const on = option === selected;
          return (
            <AnimatedPressable
              key={String(option)}
              style={[styles.choice, large && styles.choiceLarge, on && styles.choiceOn]}
              onPress={() => {
                onSelect(option);
                setPage(0);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={labelOf(option)}
              testID={`chooser-${id}-${option}`}
            >
              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{labelOf(option)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('activityChooser.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={[styles.body, large && styles.bodyLarge]}>{t('activityChooser.intro')}</Text>
        {radio(t('activityChooser.timeTitle'), TIME_BUDGETS, minutes, (option) => t(`activityChooser.time.${option}`), setMinutes, 'time')}
        {radio(t('activityChooser.interestTitle'), INTERESTS, interest, (option) => t(`activityChooser.interests.${option}`), setInterest, 'interest')}

        {result?.kind === 'suggestions' ? (
          <View style={styles.group} testID="chooser-results">
            <Text style={styles.section} accessibilityRole="header" accessibilityLiveRegion="polite">
              {t('activityChooser.suggestionsTitle')}
            </Text>
            {result.suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.activity.id} suggestion={suggestion} title={titleOf(suggestion.activity)} pathTitle={signals.pathStep?.pathTitle ?? ''} offline={signals.isOffline} large={large} />
            ))}
            {result.pages > 1 ? (
              <>
                <Text style={styles.meta}>{t('activityChooser.pageOf', { page: result.page + 1, pages: result.pages })}</Text>
                <Button label={t('activityChooser.showOthers')} variant="secondary" onPress={() => setPage((current) => current + 1)} testID="chooser-more" />
              </>
            ) : (
              <Text style={styles.meta} testID="chooser-no-others">
                {t('activityChooser.noOthers')}
              </Text>
            )}
          </View>
        ) : null}

        {result?.kind === 'empty' ? (
          <View style={styles.empty} testID={`chooser-empty-${result.why}`} accessibilityLiveRegion="polite">
            <Text style={styles.body}>
              {result.why === 'needsMoreTime' && result.shortest
                ? t('activityChooser.empty.needsMoreTime', { minutes, title: titleOf(result.shortest), shortest: result.shortest.minutes })
                : t(`activityChooser.empty.${result.why}`)}
            </Text>
            {result.why === 'needsMoreTime' && result.shortest ? <Button label={t('activityChooser.showShortest', { title: titleOf(result.shortest) })} variant="secondary" onPress={() => router.push(result.shortest!.route as never)} testID="chooser-shortest" /> : null}
          </View>
        ) : null}

        <Text style={styles.meta}>{t('activityChooser.privacy')}</Text>
      </ScrollView>
    </View>
  );
}

function SuggestionCard({ suggestion, title, pathTitle, offline, large }: { suggestion: Suggestion; title: string; pathTitle: string; offline: boolean; large: boolean }) {
  const { t } = useTranslation();
  const { activity, reason } = suggestion;
  const estimate = t('activityChooser.estimate', { minutes: activity.minutes, basis: t(`activityChooser.basis.${activity.basis}`) });
  const reasonText = t(`activityChooser.reason.${reason}`, { path: pathTitle });
  const lines = [t(explanationKey(activity)), t(activity.descriptionKey), estimate, reasonText, activity.together ? t('activityChooser.together') : null, offline && suggestion.worksOffline ? t('activityChooser.worksOffline') : null].filter(Boolean) as string[];
  return (
    <AnimatedPressable style={styles.card} onPress={() => router.push(activity.route as never)} accessibilityRole="button" accessibilityLabel={`${title}. ${lines.join('. ')}`} accessibilityHint={t('activityChooser.open')} testID={`chooser-suggestion-${activity.id}`}>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, large && styles.bodyLarge]}>{title}</Text>
        <Text style={styles.explain}>{lines[0]}</Text>
        <Text style={styles.body}>{t(activity.descriptionKey)}</Text>
        <Text style={styles.meta}>{estimate}</Text>
        <Text style={styles.meta}>{reasonText}</Text>
        {activity.together ? <Text style={styles.meta}>{t('activityChooser.together')}</Text> : null}
        {offline && suggestion.worksOffline ? <Text style={styles.meta}>{t('activityChooser.worksOffline')}</Text> : null}
      </View>
      <ChevronRight size={20} color={colors.textSecondary} />
    </AnimatedPressable>
  );
}

/** Home entry (under For You Today). */
export function ActivityChooserEntry() {
  const { t } = useTranslation();
  return (
    <View style={styles.entry} testID="chooser-entry-card">
      <Text style={styles.cardTitle}>{t('activityChooser.entryTitle')}</Text>
      <Text style={styles.meta}>{t('activityChooser.entryBody')}</Text>
      <Button label={t('activityChooser.entryButton')} variant="secondary" onPress={() => router.push('/activities' as never)} testID="chooser-entry" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  group: { gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  explain: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  choiceLarge: { minHeight: 52 },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  choiceTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  empty: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  entry: { gap: spacing.xs, padding: spacing.md, marginTop: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
});
