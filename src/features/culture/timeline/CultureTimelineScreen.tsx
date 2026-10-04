import { router } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, History, Search as SearchIcon } from 'lucide-react-native';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, Chip, IconButton } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { sourceExplorerRoute } from '@/features/culture/sources/sourceExplorer';
import { thenAndNowFor, thenNowRoute, THEN_NOW_PRESENTATION } from '@/features/culture/thenNow/thenAndNow';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import type { CultureItemRow } from '@/services/content/types';
import { normalizeVerification, verificationCopyKey } from '@/services/content/verification';
import { formatLongDate } from '@/services/i18n/formatDate';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { CULTURE_TIMELINE, excerptFor, filterTimeline, sortTimeline, validEvents, type CultureTimelineEvent, type TimelineSort } from './cultureTimeline';

type Row = { event: CultureTimelineEvent; item: CultureItemRow; title: string; excerpt: string | null; date: string };

export function timelineDateLabel(event: CultureTimelineEvent, language: SupportedLanguage, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (event.datePrecision === 'exact_date' && event.exactDate) return t(event.displayDateKey, { date: formatLongDate(event.exactDate, language) });
  if (event.datePrecision === 'year_range') return t(event.displayDateKey, { start: event.startYear, end: event.endYear });
  return t(event.displayDateKey, { year: event.year });
}

/**
 * /culture/timeline - curated dates from OYNO's authored, sourced stories
 * (cultureTimeline.ts). Each card quotes the sentence the date comes from,
 * shows that story's verification, and opens the EXISTING article, Source
 * Explorer and Then & Now screens. Events whose text can't be confirmed in
 * the loaded content are simply not shown.
 */
export function CultureTimelineScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = THEN_NOW_PRESENTATION[experience];
  const items = useAllCultureItems();
  const [order, setOrder] = useState<TimelineSort>('oldest');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  useEffect(() => {
    track('culture_timeline_opened', {});
  }, []);

  const rows = useMemo<Row[]>(() => {
    const data = items.data ?? [];
    return sortTimeline(validEvents(CULTURE_TIMELINE, data), order).flatMap((event) => {
      const item = data.find((candidate) => candidate.id === event.contentItemId);
      if (!item) return [];
      const text = item[event.sourceField] as string | null;
      return [{ event, item, title: t(event.titleKey), excerpt: excerptFor(text, event.year), date: timelineDateLabel(event, language, t) }];
    });
  }, [items.data, order, t, language]);
  const shown = filterTimeline(rows, deferred);

  if (isWaitingForNetwork(items)) return <OfflineUnavailable onRetry={() => void items.refetch()} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, presentation.editorial && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('cultureTimeline.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t(experience === 'child' ? 'cultureTimeline.introChild' : 'cultureTimeline.intro')}</Text>
        <View style={styles.field}>
          <SearchIcon size={16} color={colors.textSecondary} strokeWidth={2.25} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('cultureTimeline.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityRole="search"
            accessibilityLabel={t('cultureTimeline.searchPlaceholder')}
          />
        </View>
        <View style={styles.sortRow} accessibilityRole="tablist">
          {(['oldest', 'newest'] as const).map((value) => (
            <Chip key={value} label={t(`cultureTimeline.sort.${value}`)} selected={order === value} accessibilityRole="tab" onPress={() => setOrder(value)} />
          ))}
        </View>

        {items.isLoading ? <ActivityIndicator color={colors.primary} accessibilityLabel={t('common.loading')} /> : null}
        {!items.isLoading && shown.length === 0 ? <Text style={styles.empty}>{rows.length === 0 ? t('cultureTimeline.empty') : t('cultureTimeline.noMatches')}</Text> : null}

        <View>
          {shown.map((row, index) => (
            <TimelineCard key={row.event.id} row={row} last={index === shown.length - 1} excerptLines={presentation.excerptLines} showVerification={experience !== 'child'} language={language} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function TimelineCard({ row, last, excerptLines, showVerification, language }: { row: Row; last: boolean; excerptLines: number; showVerification: boolean; language: SupportedLanguage }) {
  const { t } = useTranslation();
  const { event, item, title, excerpt, date } = row;
  const image = cultureItemImages[item.id]?.[0];
  const verification = t(verificationCopyKey(normalizeVerification(item.accuracy_level)));
  const hasThenNow = !!thenAndNowFor(item);
  const open = () => {
    track('culture_timeline_event_opened', { event_id: event.id, content_id: item.id });
    router.push(`/culture/item/${item.id}` as never);
  };
  return (
    <View style={styles.entry}>
      <View style={styles.rail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.dot} />
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.card}>
        <AnimatedPressable
          style={styles.cardMain}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${date}. ${title}.${showVerification ? ` ${verification}.` : ''} ${t('cultureTimeline.openStory', { title: item.title })}`}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.date}>{date}</Text>
            <Text style={styles.cardTitle}>{title}</Text>
            {excerpt ? (
              <Text style={styles.excerpt} numberOfLines={excerptLines}>
                “{excerpt}”
              </Text>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {item.title}
              {showVerification ? ` · ${verification}` : ''}
            </Text>
          </View>
          {image ? <Image source={image} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        </AnimatedPressable>
        <KyrgyzOnlyNote status={item.translation?.status} language={language} />
        <View style={styles.actions}>
          <Button label={t('cultureTimeline.viewSources')} size="sm" variant="secondary" icon={<BookOpen size={14} color={colors.primary} strokeWidth={2} />} onPress={() => router.push(sourceExplorerRoute('culture_item', event.sourceIds[0] ?? item.id) as never)} />
          {hasThenNow ? <Button label={t('cultureTimeline.thenNow')} size="sm" variant="secondary" icon={<History size={14} color={colors.primary} strokeWidth={2} />} onPress={() => router.push(thenNowRoute(item.id) as never)} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Culture entry row. */
export function TimelineEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.entryRow} onPress={() => router.push('/culture/timeline' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('cultureTimeline.title')}. ${t('cultureTimeline.entryMeta')}`}>
      <History size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{t('cultureTimeline.title')}</Text>
        <Text style={styles.meta}>{t('cultureTimeline.entryMeta')}</Text>
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  intro: { ...textStyles.body, color: colors.textSecondary },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  input: { flex: 1, ...textStyles.body, color: colors.textPrimary },
  sortRow: { flexDirection: 'row', gap: spacing.xs },
  empty: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  entry: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: spacing.md + 2, backgroundColor: colors.accentGold, borderWidth: 2, borderColor: colors.primary },
  line: { flex: 1, width: 2, marginTop: 2, backgroundColor: colors.borderSubtle },
  card: { flex: 1, gap: spacing.xs, padding: spacing.md, marginBottom: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardMain: { flexDirection: 'row', gap: spacing.sm },
  date: { ...typography.overline, color: colors.accentTerracotta },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  excerpt: { ...textStyles.body, fontStyle: 'italic', color: colors.textSecondary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
});
