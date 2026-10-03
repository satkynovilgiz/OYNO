import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton, ProgressBar } from '@/components/ui';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { useWeeklyGoal } from './useWeeklyGoal';
import { GOAL_OPTIONS, type GoalSize } from './weeklyGoal';
import { usePrivateSyncScope } from '@/services/sync/privateSync/usePrivateSyncScope';

/** /profile/weekly-goal - set, change or turn off a gentle weekly goal.
 * Changing it mid-week keeps this week's count; turning it off only hides
 * it (no history is deleted). Never a streak. */
export function WeeklyGoalScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const syncScope = usePrivateSyncScope();
  const insets = useSafeAreaInsets();
  const { goal, state, setGoal } = useWeeklyGoal();
  const options: (GoalSize | null)[] = [...GOAL_OPTIONS, null];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          {t('weeklyGoal.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.intro}>{t('weeklyGoal.intro')}</Text>
        {state ? (
          <View style={styles.progressCard} accessible accessibilityLabel={state.complete ? t('weeklyGoal.complete') : t('weeklyGoal.progressA11y', { done: state.done, goal: state.goal })}>
            <Text style={styles.progressLabel}>{t('weeklyGoal.thisWeek')}</Text>
            <Text style={styles.progressValue}>{state.complete ? `✓ ${t('weeklyGoal.complete')}` : t('weeklyGoal.progress', { done: state.done, goal: state.goal })}</Text>
            <ProgressBar progress={Math.min(1, state.done / state.goal)} height={6} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
          </View>
        ) : null}
        <Text style={styles.groupLabel}>{goal ? t('weeklyGoal.change') : t('weeklyGoal.set')}</Text>
        <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
          {options.map((option) => {
            const selected = goal === option;
            const label = option ? t('weeklyGoal.option', { count: option }) : t('weeklyGoal.none');
            return (
              <AnimatedPressable
                key={String(option)}
                style={[styles.option, selected && styles.optionOn]}
                onPress={() => setGoal(option)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                accessibilityLabel={label}
              >
                <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                  {selected ? '✓ ' : ''}
                  {label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <Text style={styles.note}>{t('weeklyGoal.counts')}</Text>
        <Text style={styles.note}>{t(syncScope === 'account' ? 'weeklyGoal.accountNote' : 'weeklyGoal.deviceNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  intro: { ...textStyles.body, color: colors.textSecondary },
  progressCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  progressLabel: { ...typography.overline, color: colors.accentTerracotta },
  progressValue: { ...textStyles.title, color: colors.textPrimary },
  groupLabel: { ...typography.overline, color: colors.accentTerracotta },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  optionText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  optionTextOn: { fontWeight: '700', color: colors.primary },
  note: { ...textStyles.small, color: colors.textMuted },
});
