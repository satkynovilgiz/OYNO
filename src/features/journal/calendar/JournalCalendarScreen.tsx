import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, Chip, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { formatLongDate, formatMonthYear } from '@/services/i18n/formatDate';
import { useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { FILTERS, MemoryCard } from '../JournalScreen';
import type { JournalFilter } from '../journalModel';
import { dateIndex, entriesOn, monthGrid, monthOf, shiftMonth, type MonthRef } from './journalCalendar';

const WEEKDAYS: Record<SupportedLanguage, string[]> = {
  kg: ['Дш', 'Шш', 'Шр', 'Бш', 'Жм', 'Иш', 'Жк'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

/**
 * /journal/calendar - the private Journal by memory date. Derived from the
 * Journal store (account-bound: cleared on sign-out), so it works offline
 * and never shows another account's memories. The timeline stays as it is.
 */
export function JournalCalendarScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = (['kg', 'ru', 'en'].includes(i18n.language) ? i18n.language : 'kg') as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const entries = useJournalStore((state) => state.entries);
  const today = localDateKey();
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const [selected, setSelected] = useState<string>(today);
  const [filter, setFilter] = useState<JournalFilter>('all');

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
    track('journal_calendar_opened');
  }, []);

  const index = useMemo(() => dateIndex(entries, filter), [entries, filter]);
  const cells = monthGrid(month);
  const dayEntries = entriesOn(entries, selected, filter);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`;
  const memoriesLabel = (count: number) => (count > 0 ? t('journalCalendar.memories', { count }) : t('journalCalendar.noMemories'));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header">
          {t('journalCalendar.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.monthRow}>
          <IconButton icon={ChevronLeft} size={40} iconSize={18} elevated={false} accessibilityLabel={t('journalCalendar.previousMonth')} onPress={() => setMonth(shiftMonth(month, -1))} />
          <Text style={styles.month} accessibilityRole="header" accessibilityLiveRegion="polite">
            {formatMonthYear(monthKey, language)}
          </Text>
          <IconButton icon={ChevronRight} size={40} iconSize={18} elevated={false} accessibilityLabel={t('journalCalendar.nextMonth')} onPress={() => setMonth(shiftMonth(month, 1))} />
        </View>
        <Button
          label={t('journalCalendar.today')}
          variant="text"
          onPress={() => {
            setMonth(monthOf(today));
            setSelected(today);
          }}
        />

        {!isChild ? (
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => (
              <Chip key={option} label={t(`journal.filters.${option}`)} selected={filter === option} onPress={() => setFilter(option)} accessibilityRole="tab" />
            ))}
          </View>
        ) : null}

        <View style={styles.weekRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAYS[language].map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((key, position) => {
            if (!key) return <View key={`pad-${position}`} style={[styles.cell, isChild && styles.cellChild]} />;
            const count = index.get(key) ?? 0;
            const isSelected = key === selected;
            const isToday = key === today;
            return (
              <AnimatedPressable
                key={key}
                style={[styles.cell, isChild && styles.cellChild, isToday && styles.today, isSelected && styles.selected]}
                onPress={() => setSelected(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatLongDate(key, language)}${isToday ? `, ${t('journalCalendar.today')}` : ''}, ${memoriesLabel(count)}`}
              >
                <Text style={[styles.dayNumber, isChild && styles.dayNumberChild, isSelected && styles.dayNumberSelected]}>{Number(key.slice(8))}</Text>
                {/* Memory marker: a dot (count when several) - distinct from the today ring. */}
                {count > 0 ? <View style={[styles.dot, count > 1 && styles.dotWide, isSelected && styles.dotSelected]}>{count > 1 ? <Text style={[styles.dotCount, isSelected && styles.dotCountSelected]}>{count}</Text> : null}</View> : null}
              </AnimatedPressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.section} accessibilityRole="header">
            {formatLongDate(selected, language)} · {memoriesLabel(dayEntries.length)}
          </Text>
          {dayEntries.map((entry, position) => (
            <MemoryCard key={entry.id} entry={entry} experience={experience} index={position} language={language} />
          ))}
          {selected <= today ? (
            <Button label={t('journalCalendar.addMemory')} variant="secondary" icon={<Plus size={16} color={colors.primary} strokeWidth={2.5} />} onPress={() => router.push(`/journal/new?date=${selected}` as never)} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { ...typography.h2, color: colors.textPrimary, textTransform: 'capitalize' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...textStyles.small, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: cardRadii.compact, gap: 2 },
  cellChild: { aspectRatio: 0.85 },
  today: { borderWidth: 1.5, borderColor: colors.accentTerracotta },
  selected: { backgroundColor: colors.primary },
  dayNumber: { ...textStyles.bodyMedium, color: colors.textPrimary },
  dayNumberChild: { fontSize: 20, fontWeight: '700' },
  dayNumberSelected: { color: colors.textOnPrimary, fontWeight: '700' },
  dot: { minWidth: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentGold, alignItems: 'center', justifyContent: 'center' },
  dotWide: { height: 12, minWidth: 14, borderRadius: 6 },
  dotSelected: { backgroundColor: colors.textOnPrimary },
  dotCount: { fontSize: 9, lineHeight: 12, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 3 },
  dotCountSelected: { color: colors.primary },
  section: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
});
