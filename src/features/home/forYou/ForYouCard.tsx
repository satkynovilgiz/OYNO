import { router } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable, Button, ProgressBar } from '@/components/ui';
import { useWeeklyGoal } from '@/features/goals/useWeeklyGoal';
import type { AgeExperience } from '@/services/ageExperience/types';
import { FOCUS_SESSION_ROUTE } from '@/features/study/session/focusSession';
import { track } from '@/services/analytics/analytics';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { useForYouToday } from './useForYouToday';
import type { ForYouReason } from './forYouToday';

const FOCUS_REASONS: ForYouReason[] = ['study_queue', 'review_mistakes', 'review_glossary', 'continue_learning_path', 'continue_reading'];

/**
 * Home "For You Today": ONE learning recommendation (deterministic, from
 * existing selectors; never the same thing as the hero above) with a quiet
 * "Not now" for today, and - when a weekly goal is set - one small line of
 * weekly progress. No carousel, no refresh button, no private text.
 */
export function ForYouSection({ experience, heroRoute }: { experience: AgeExperience; heroRoute: string | null }) {
  const { t } = useTranslation();
  const { card, owner } = useForYouToday(heroRoute);
  const { state: goal } = useWeeklyGoal();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  const copy = card
    ? {
        heading: t(`forYou.reason.${card.reason}.heading`, { count: card.count ?? 0 }),
        title: card.title,
        detail:
          card.reason === 'continue_reading'
            ? t('reading.percentRead', { percent: card.count ?? 0 })
            : card.reason === 'continue_learning_path'
              ? null
              : t(`forYou.reason.${card.reason}.detail`, { count: card.count ?? 0 }),
      }
    : null;

  return (
    <View style={styles.section}>
      {card && copy ? (
        <View style={[styles.card, isAdult && styles.cardEditorial]}>
          <Text style={styles.kicker}>{t('forYou.title')}</Text>
          <View style={styles.row}>
            {card.image ? <Image source={card.image as ImageSourcePropType} style={[styles.thumb, isChild && styles.thumbChild]} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbIcon, isChild && styles.thumbChild]}><Sparkles size={20} color={colors.accentGold} strokeWidth={1.75} /></View>}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.heading, isChild && styles.headingChild, isAdult && styles.headingEditorial]}>{copy.heading}</Text>
              {copy.title ? (
                <Text style={styles.title} numberOfLines={2}>
                  {copy.title}
                </Text>
              ) : null}
              {copy.detail && !isChild ? <Text style={styles.detail}>{copy.detail}</Text> : null}
            </View>
          </View>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('forYou.open')}
                size="sm"
                onPress={() => {
                  track('home_recommendation_opened', { recommendation_type: card.reason });
                  router.push(card.route as never);
                }}
              />
            </View>
            <AnimatedPressable
              style={styles.notNow}
              onPress={() => {
                track('home_recommendation_dismissed', { recommendation_type: card.reason });
                useWeeklyGoalStore.getState().dismissForYou(owner, localDateKey());
              }}
              accessibilityRole="button"
              accessibilityLabel={t('forYou.notNow')}
            >
              <Text style={styles.notNowText}>{t('forYou.notNow')}</Text>
            </AnimatedPressable>
          </View>
          {/* Study-type suggestions may also be done as a short focus session. */}
          {FOCUS_REASONS.includes(card.reason) ? (
            <AnimatedPressable style={styles.notNow} onPress={() => router.push(FOCUS_SESSION_ROUTE as never)} accessibilityRole="button" accessibilityLabel={t('studySession.startFromForYou')}>
              <Text style={styles.focusText}>{t('studySession.startFromForYou')}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}

      {goal ? (
        <AnimatedPressable
          style={styles.goal}
          onPress={() => router.push('/profile/weekly-goal' as never)}
          press="soft"
          accessibilityRole="button"
          accessibilityLabel={goal.complete ? `${t('weeklyGoal.title')}. ${t('weeklyGoal.complete')}.` : `${t('weeklyGoal.title')}. ${t('weeklyGoal.progressA11y', { done: goal.done, goal: goal.goal })}`}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.goalText}>
              {goal.complete ? (
                <>
                  <Check size={12} color={colors.primary} strokeWidth={3} /> {t('weeklyGoal.complete')}
                </>
              ) : (
                `${t('weeklyGoal.title')} · ${t('weeklyGoal.progress', { done: goal.done, goal: goal.goal })}`
              )}
            </Text>
            <ProgressBar progress={Math.min(1, goal.done / goal.goal)} height={isChild ? 6 : 3} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
          </View>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardEditorial: { borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  kicker: { ...typography.overline, color: colors.accentTerracottaText },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbChild: { width: 72, height: 72 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceFeature },
  heading: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  headingChild: { fontSize: 18 },
  headingEditorial: { ...editorial(textStyles.bodyMedium) },
  title: { ...textStyles.body, color: colors.textPrimary },
  detail: { ...textStyles.small, color: colors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notNow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  notNowText: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  focusText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  goal: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  goalText: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
});
