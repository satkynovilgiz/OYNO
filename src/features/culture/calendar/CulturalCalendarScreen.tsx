import { router } from 'expo-router';
import { Bell, BellOff, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { comparisonById, compareRoute } from '@/features/culture/compare/cultureCompare';
import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { LEARNING_PATHS, learnRoute } from '@/features/learn/learningPaths';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { normalizeVerification, verificationCopyKey } from '@/services/content/verification';
import { formatLongDate } from '@/services/i18n/formatDate';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { cancelReminder, reminderDate, remindMe, useCalendarReminders } from './calendarReminders';
import { calendarList, CULTURAL_CALENDAR, homeEvent, isToday, thisMonth, todayEvents, upcoming, type DatedEvent, type Occurrence } from './culturalCalendar';

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function formatOccurrence(occurrence: Occurrence | null, language: SupportedLanguage, unconfirmed: string): string {
  if (!occurrence) return unconfirmed;
  const start = formatLongDate(keyOf(occurrence.start), language);
  return occurrence.start.getTime() === occurrence.end.getTime() ? start : `${start} - ${formatLongDate(keyOf(occurrence.end), language)}`;
}

/** /culture/calendar - curated dates only (bundled; works offline). */
export function CulturalCalendarScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const now = new Date();
  const list = calendarList(CULTURAL_CALENDAR, now);
  const today = todayEvents(list, now);
  const month = thisMonth(list, now).filter((entry) => !today.includes(entry));
  const next = upcoming(list, now).filter((entry) => !today.includes(entry) && !month.includes(entry));

  const section = (title: string, entries: DatedEvent[]) =>
    entries.length > 0 ? (
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.section} accessibilityRole="header">
          {title}
        </Text>
        {entries.map((entry) => (
          <EventRow key={entry.event.id} entry={entry} language={language} />
        ))}
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('culturalCalendar.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.intro}>{t('culturalCalendar.intro')}</Text>
        {section(t('culturalCalendar.today'), today)}
        {section(t('culturalCalendar.thisMonth'), month)}
        {section(t('culturalCalendar.upcoming'), next)}
        {section(t('culturalCalendar.all'), list)}
      </ScrollView>
    </View>
  );
}

function EventRow({ entry, language }: { entry: DatedEvent; language: SupportedLanguage }) {
  const { t } = useTranslation();
  const when = formatOccurrence(entry.occurrence, language, t('culturalCalendar.dateNotConfirmed'));
  return (
    <AnimatedPressable style={styles.row} onPress={() => router.push(`/culture/calendar/${entry.event.id}` as never)} accessibilityRole="button" accessibilityLabel={`${t(entry.event.titleKey)}. ${when}`}>
      <CalendarDays size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{t(entry.event.titleKey)}</Text>
        <Text style={styles.meta}>{when}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

/** /culture/calendar/[id] - date, the authored text it comes from, that item's verification + sources, related content. */
export function CalendarEventScreen({ id, onPressBack }: { id: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { data: items } = useAllCultureItems();
  const reminders = useCalendarReminders((state) => state.ids);
  useEffect(() => {
    void useCalendarReminders.getState().load();
  }, []);
  const entry = calendarList(CULTURAL_CALENDAR, new Date()).find((candidate) => candidate.event.id === id);

  if (!entry) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>
        <Text style={[styles.intro, { padding: spacing.lg }]}>{t('culturalCalendar.notFound')}</Text>
      </View>
    );
  }
  const { event, occurrence } = entry;
  const source: CultureItemRow | undefined = items?.find((item) => item.id === event.sourceItemId);
  const description = source ? (source[event.description.field] as string | null) : null;
  const reminded = reminders.includes(event.id);
  const title = t(event.titleKey);

  const onRemind = async () => {
    if (!occurrence) return;
    if (reminded) {
      await cancelReminder(event.id);
      showToast(t('culturalCalendar.reminderOff'));
      return;
    }
    const result = await remindMe(event.id, reminderDate(occurrence.start), { title, body: formatOccurrence(occurrence, language, ''), route: `/culture/calendar/${event.id}` });
    showToast(t(`culturalCalendar.remind.${result}`), { tone: result === 'scheduled' ? 'success' : 'info' });
  };

  const relatedItems = event.cultureItemIds.map((itemId) => items?.find((item) => item.id === itemId)).filter((item): item is CultureItemRow => !!item);
  const glossary = (event.related.glossaryIds ?? []).map((termId) => GLOSSARY.find((term) => term.id === termId)).filter((term): term is (typeof GLOSSARY)[number] => !!term);
  const paths = (event.related.pathIds ?? []).map((pathId) => LEARNING_PATHS.find((path) => path.id === pathId)).filter((path): path is (typeof LEARNING_PATHS)[number] => !!path);
  const compares = (event.related.compareIds ?? []).map((compareId) => comparisonById(compareId)).filter((pair): pair is NonNullable<ReturnType<typeof comparisonById>> => !!pair);
  const titleOfItem = (itemId: string) => items?.find((item) => item.id === itemId)?.title ?? '';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.kicker}>{t('culturalCalendar.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={[styles.eventTitle, experience === 'adult' && styles.eventTitleEditorial]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.date}>{formatOccurrence(occurrence, language, t('culturalCalendar.dateNotConfirmed'))}</Text>
        {source ? <Text style={styles.meta}>{t(verificationCopyKey(normalizeVerification(source.accuracy_level)))}</Text> : null}
        {source ? <KyrgyzOnlyNote status={source.translation?.status} language={i18n.language} /> : null}
        {description ? <Text style={styles.body}>{description}</Text> : null}
        {occurrence ? (
          <Button
            label={reminded ? t('culturalCalendar.reminderOn') : t('culturalCalendar.remindMe')}
            variant="secondary"
            icon={reminded ? <BellOff size={16} color={colors.primary} strokeWidth={2} /> : <Bell size={16} color={colors.primary} strokeWidth={2} />}
            onPress={() => void onRemind()}
          />
        ) : null}
        {source ? <SourcesAndNotes contentType="culture_item" level={source.accuracy_level} sources={source.sources} contentId={source.id} /> : null}

        {relatedItems.length + glossary.length + paths.length + compares.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.section} accessibilityRole="header">
              {t('culturalCalendar.related')}
            </Text>
            {relatedItems.map((item) => (
              <Link key={item.id} label={item.title} onPress={() => router.push(`/culture/item/${item.id}` as never)} />
            ))}
            {glossary.map((term) => (
              <Link key={term.id} label={`${t('glossary.title')}: ${term.term}`} onPress={() => router.push(`/culture/glossary/${term.id}` as never)} />
            ))}
            {paths.map((path) => (
              <Link key={path.id} label={`${t('learningPaths.title')}: ${t(path.titleKey)}`} onPress={() => router.push(learnRoute(path.id) as never)} />
            ))}
            {compares.map((pair) => (
              <Link key={pair.id} label={`${t('compare.title')}: ${titleOfItem(pair.leftItemId)} · ${titleOfItem(pair.rightItemId)}`} onPress={() => router.push(compareRoute(pair.id) as never)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

/** Culture entry row. */
export function CalendarEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.row} onPress={() => router.push('/culture/calendar' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('culturalCalendar.title')}. ${t('culturalCalendar.entryMeta')}`}>
      <CalendarDays size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{t('culturalCalendar.title')}</Text>
        <Text style={styles.meta}>{t('culturalCalendar.entryMeta')}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  kicker: { ...typography.overline, color: colors.accentTerracotta, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  intro: { ...textStyles.body, color: colors.textSecondary },
  section: { ...typography.overline, color: colors.accentTerracotta },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  eventTitle: { ...typography.h1, color: colors.textPrimary },
  eventTitleEditorial: { ...editorial(typography.h1) },
  date: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.accentTerracotta },
  body: { ...textStyles.body, fontSize: 16, lineHeight: 25, color: colors.textPrimary },
});

/** Home: ONLY on the day or within HOME_WINDOW_DAYS before it - never permanent, no countdown. */
export function CalendarHomeCard() {
  const { t, i18n } = useTranslation();
  const entry = homeEvent(calendarList(CULTURAL_CALENDAR, new Date()), new Date());
  if (!entry) return null;
  const today = isToday(entry.occurrence, new Date());
  return (
    <AnimatedPressable style={[styles.row, { marginTop: spacing.sm }]} onPress={() => router.push(`/culture/calendar/${entry.event.id}` as never)} accessibilityRole="button" accessibilityLabel={`${today ? t('culturalCalendar.today') : t('culturalCalendar.soon')}. ${t(entry.event.titleKey)}`}>
      <CalendarDays size={18} color={colors.accentTerracotta} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.meta}>{today ? t('culturalCalendar.today') : formatOccurrence(entry.occurrence, i18n.language as SupportedLanguage, '')}</Text>
        <Text style={styles.rowTitle}>{t(entry.event.titleKey)}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}
