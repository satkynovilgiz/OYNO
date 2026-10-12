import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { itemKey, MAX_ITEMS } from '@/features/nextVisit/nextVisitModel';
import { announce } from '@/services/a11y/announce';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { ownerNotebook, useListeningNotebookStore } from '@/store/useListeningNotebookStore';
import { ownerQueue, useNextVisitStore } from '@/store/useNextVisitStore';
import { ownerQuestions, useQuestionsStore } from '@/store/useQuestionsStore';
import { ownerScrapbooks, useScrapbookStore } from '@/store/useScrapbookStore';
import { ownerBookmarks, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { designItems, groupByType, inRange, momentItems, noteItems, planTargets, presetRange, questionItems, rangeBounds, scrapbookItems, search, type Preset, type RecapItem, type RecapType } from './discoveryRecapModel';

type SourceStatus = 'loading' | 'ready' | 'error' | 'unavailable';
const fromStore = (status: string): SourceStatus => (status === 'ready' ? 'ready' : status === 'error' ? 'error' : 'loading');

/**
 * /profile/discovery-recap - a private look back over explicit saves in a
 * date range (discoveryRecapModel.ts). Each source loads on its own; a
 * failing one never hides the others. Nothing here is sent to analytics.
 */
export function DiscoveryRecapScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const articles = useAllCultureItems();
  const bookmarkStatus = useSectionBookmarksStore((s) => s.status);
  const bookmarks = useSectionBookmarksStore((s) => s.saved);
  const questionStatus = useQuestionsStore((s) => s.status);
  const questions = useQuestionsStore((s) => s.saved);
  const notebookStatus = useListeningNotebookStore((s) => s.status);
  const notebook = useListeningNotebookStore((s) => s.saved);
  const scrapStatus = useScrapbookStore((s) => s.status);
  const scrapbooks = useScrapbookStore((s) => s.saved);
  const designs = useOymoCreations();
  const planRaw = useNextVisitStore((s) => s.saved[owner]);
  const planStatus = useNextVisitStore((s) => s.status);
  const [preset, setPreset] = useState<Preset>('last30');
  const [custom, setCustom] = useState(() => presetRange('last30', Date.now()));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; skipped: number; full: boolean; failed: boolean; unsupported: number } | null>(null);
  const shownOwner = useRef(owner);
  useEffect(() => {
    void useSectionBookmarksStore.getState().load();
    void useQuestionsStore.getState().load();
    void useListeningNotebookStore.getState().load();
    void useScrapbookStore.getState().load();
    void useNextVisitStore.getState().load();
  }, []);
  // Another account: nothing selected or reported for the previous one stays.
  useEffect(() => {
    shownOwner.current = owner;
    setSelected([]);
    setResult(null);
    setQuery('');
  }, [owner]);

  const range = preset === 'custom' ? custom : presetRange(preset, Date.now());
  const bounds = rangeBounds(range.from, range.to);
  const articleIds = useMemo(() => (articles.data ? new Set(articles.data.map((a) => a.id)) : null), [articles.data]);

  const sources: { type: RecapType; status: SourceStatus; items: RecapItem[]; retry?: () => void }[] = [
    { type: 'note', status: fromStore(bookmarkStatus), items: noteItems(Object.values(ownerBookmarks(bookmarks, owner))), retry: () => void useSectionBookmarksStore.getState().retryLoad() },
    { type: 'question', status: fromStore(questionStatus), items: questionItems(Object.values(ownerQuestions(questions, owner))), retry: () => void useQuestionsStore.getState().retryLoad() },
    { type: 'moment', status: fromStore(notebookStatus), items: momentItems(Object.values(ownerNotebook(notebook, owner))), retry: () => void useListeningNotebookStore.getState().retryLoad() },
    // Designs live in the account (row-level security returns only this account's rows); guests have none - same rule as the Shelf.
    { type: 'design', status: owner === 'guest' ? 'unavailable' : designs.data ? 'ready' : designs.isError ? 'error' : 'loading', items: owner === 'guest' ? [] : designItems(designs.data ?? []), retry: () => void designs.refetch() },
    { type: 'scrapbook', status: fromStore(scrapStatus), items: scrapbookItems(ownerScrapbooks(scrapbooks, owner)), retry: () => void useScrapbookStore.getState().retryLoad() },
  ];
  // A record whose article is gone stays, as a placeholder: its own words are kept, it just can't be planned.
  const resolved = (item: RecapItem): RecapItem & { missing: boolean } => {
    const missing = item.plan?.kind === 'article' && articleIds !== null && !articleIds.has(item.plan.id);
    return { ...item, missing, plan: missing ? null : item.plan, route: missing && item.type === 'note' ? null : item.route };
  };
  const all = sources.flatMap((source) => (source.status === 'ready' ? source.items : [])).map(resolved);
  const shown = bounds ? search(inRange(all, bounds), query) : [];
  const shownMap = new Map(shown.map((item) => [item.key, item as RecapItem & { missing: boolean }]));
  const groups = groupByType(shown);
  const date = (iso: string) => new Intl.DateTimeFormat(i18n.language === 'kg' ? 'ky' : i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  const plan = ownerQueue({ [owner]: planRaw } as never, owner);

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  const addToPlan = async () => {
    const startedFor = owner;
    const { supported, unsupported } = planTargets(shown, selected);
    let added = 0;
    let skipped = 0;
    let full = false;
    let failed = false;
    for (const target of supported) {
      const current = ownerQueue(useNextVisitStore.getState().saved, startedFor);
      if (current.some((item) => itemKey(item) === itemKey(target))) {
        skipped += 1;
        continue;
      }
      if (current.length >= MAX_ITEMS) {
        full = true;
        skipped += 1;
        continue;
      }
      const ok = await useNextVisitStore.getState().change(startedFor, { type: 'add', item: { kind: target.kind, id: target.id, titleSnapshot: target.title }, now: new Date().toISOString() });
      if (ok) added += 1;
      else failed = true;
    }
    if (shownOwner.current !== startedFor) return;
    setResult({ added, skipped, full, failed, unsupported });
    announce(t('discoveryRecap.addedAnnounce', { count: added }));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('discoveryRecap.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="discovery-recap">
        <Text style={styles.body}>{t('discoveryRecap.intro')}</Text>
        <Text style={styles.note} testID="discovery-recap-included">
          {t('discoveryRecap.included')}
        </Text>

        <Text style={styles.section}>{t('discoveryRecap.rangeTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('discoveryRecap.rangeTitle')}>
          {(['last7', 'last30', 'thisMonth', 'custom'] as const).map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, preset === option && styles.chipOn]} onPress={() => setPreset(option)} accessibilityRole="radio" accessibilityState={{ checked: preset === option }} aria-checked={preset === option} testID={`recap-range-${option}`}>
              <Text style={[styles.chipText, preset === option && styles.chipTextOn]}>{t(`discoveryRecap.ranges.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {preset === 'custom' ? (
          <View style={styles.stack}>
            <TextField label={t('discoveryRecap.from')} value={custom.from} onChangeText={(from) => setCustom((c) => ({ ...c, from }))} placeholder="YYYY-MM-DD" testID="recap-from" />
            <TextField label={t('discoveryRecap.to')} value={custom.to} onChangeText={(to) => setCustom((c) => ({ ...c, to }))} placeholder="YYYY-MM-DD" testID="recap-to" />
          </View>
        ) : null}
        {bounds ? <Text style={styles.meta}>{t('discoveryRecap.rangeNote', { from: range.from, to: range.to })}</Text> : <Text style={styles.warn} testID="recap-bad-range">{t('discoveryRecap.badRange')}</Text>}
        <TextField label={t('discoveryRecap.search')} value={query} onChangeText={setQuery} placeholder={t('discoveryRecap.searchPlaceholder')} testID="recap-search" />

        {groups.map((group) => {
          const source = sources.find((s) => s.type === group.type)!;
          return (
            <View key={group.type} style={styles.stack} testID={`recap-group-${group.type}`}>
              <Text style={styles.section} accessibilityRole="header">
                {t(`discoveryRecap.types.${group.type}`)}
              </Text>
              {source.status === 'loading' ? <Text style={styles.meta}>{t('discoveryRecap.loading')}</Text> : null}
              {source.status === 'error' ? (
                <View style={styles.row} testID={`recap-error-${group.type}`}>
                  <Text style={[styles.warn, styles.flex]}>{t('discoveryRecap.sourceError')}</Text>
                  <Button label={t('common.retry')} variant="text" size="sm" onPress={source.retry ?? (() => undefined)} />
                </View>
              ) : null}
              {source.status === 'unavailable' ? <Text style={styles.meta} testID={`recap-unavailable-${group.type}`}>{t('discoveryRecap.designsNeedAccount')}</Text> : null}
              {source.status === 'ready' && group.items.length === 0 ? <Text style={styles.meta}>{t('discoveryRecap.noneInRange')}</Text> : null}
              {group.items.map((raw) => {
                const item = shownMap.get(raw.key)!;
                const isSelected = selected.includes(item.key);
                return (
                  <View key={item.key} style={[styles.card, isSelected && styles.cardOn]} testID={`recap-item-${item.key}`}>
                    <Text style={styles.meta}>{date(item.at)}</Text>
                    {item.title ? <Text style={styles.cardTitle}>{item.title}</Text> : null}
                    {item.missing ? <Text style={styles.warn}>{t('discoveryRecap.missing')}</Text> : null}
                    {item.personal ? <Text style={styles.personal}>{item.personal}</Text> : null}
                    <View style={styles.wrap}>
                      <AnimatedPressable style={[styles.check, isSelected && styles.checkOn]} onPress={() => toggle(item.key)} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} aria-checked={isSelected} accessibilityLabel={t('discoveryRecap.selectA11y', { title: item.title || item.personal || t(`discoveryRecap.types.${item.type}`) })} testID={`recap-select-${item.key}`}>
                        <Text style={[styles.checkText, isSelected && styles.checkTextOn]}>{t('discoveryRecap.select')}</Text>
                      </AnimatedPressable>
                      {item.route ? <Button label={t('discoveryRecap.open')} variant="text" size="sm" onPress={() => router.push(item.route as never)} /> : null}
                    </View>
                    {!item.plan ? <Text style={styles.meta}>{t('discoveryRecap.notPlannable')}</Text> : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={styles.card} testID="recap-plan">
          <Text style={styles.cardTitle}>{t('discoveryRecap.planTitle', { count: plan.length, max: MAX_ITEMS })}</Text>
          <Button label={t('discoveryRecap.addSelected', { count: selected.length })} disabled={selected.length === 0 || planStatus !== 'ready'} onPress={addToPlan} testID="recap-add" />
          {result ? (
            <Text style={result.failed ? styles.warn : styles.body} accessibilityLiveRegion="polite" testID="recap-add-result">
              {[t('discoveryRecap.result.added', { count: result.added }), result.skipped ? t('discoveryRecap.result.skipped', { count: result.skipped }) : null, result.full ? t('discoveryRecap.result.full', { max: MAX_ITEMS }) : null, result.unsupported ? t('discoveryRecap.result.unsupported', { count: result.unsupported }) : null, result.failed ? t('discoveryRecap.result.failed') : null].filter(Boolean).join(' ')}
            </Text>
          ) : null}
          <Button label={t('discoveryRecap.openPlan')} variant="text" size="sm" onPress={() => router.push('/profile/next-visit' as never)} testID="recap-open-plan" />
        </View>
        <Text style={styles.meta}>{t('discoveryRecap.privateNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  personal: { ...textStyles.body, color: colors.textPrimary, fontStyle: 'italic' },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  check: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  checkTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
