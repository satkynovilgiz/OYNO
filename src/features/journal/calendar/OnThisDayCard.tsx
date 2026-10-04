import { router } from 'expo-router';
import { ChevronRight, History, Lightbulb } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { onThisDay } from './journalCalendar';

/**
 * Journal timeline: ONE compact "On This Day" card, only when a memory
 * from this month/day in a previous year exists. Otherwise nothing is
 * pretended: at most a quiet "Write today's memory" (offering a writing
 * prompt) for someone who already keeps a journal and hasn't written today.
 * Analytics never carry titles, notes, dates or photo paths.
 */
export function OnThisDayCard({ onPressPrompt }: { onPressPrompt?: () => void }) {
  const { t } = useTranslation();
  const entries = useJournalStore((state) => state.entries);
  const today = localDateKey();
  const matches = onThisDay(entries, today);
  if (matches.length === 0) {
    const live = entries.filter((entry) => !entry.deletedAt);
    if (!onPressPrompt || live.length === 0 || live.some((entry) => entry.date === today)) return null;
    return (
      <AnimatedPressable style={styles.card} onPress={onPressPrompt} press="soft" accessibilityRole="button" accessibilityLabel={`${t('journalPrompts.writeToday')}. ${t('journalPrompts.writeTodayHint')}`}>
        <View style={styles.head}>
          <Lightbulb size={16} color={colors.accentTerracotta} strokeWidth={2.25} />
          <Text style={styles.title}>{t('journalPrompts.writeToday')}</Text>
        </View>
        <Text style={styles.meta}>{t('journalPrompts.writeTodayHint')}</Text>
      </AnimatedPressable>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <History size={16} color={colors.accentTerracotta} strokeWidth={2.25} />
        <Text style={styles.kicker} accessibilityRole="header">
          {t('journalCalendar.onThisDay')}
        </Text>
      </View>
      {matches.slice(0, 3).map(({ entry, yearsAgo }) => (
        <AnimatedPressable
          key={entry.id}
          style={styles.row}
          onPress={() => {
            track('journal_on_this_day_opened');
            router.push(`/journal/${entry.id}` as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${entry.title || t('journal.untitled')}. ${t('journalCalendar.yearsAgo', { count: yearsAgo })}`}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title} numberOfLines={1}>
              {entry.title || t('journal.untitled')}
            </Text>
            <Text style={styles.meta}>{t('journalCalendar.yearsAgo', { count: yearsAgo })}</Text>
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
