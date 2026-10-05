import { Check, ChevronLeft, CloudDownload, ImageOff } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { Chip } from '@/components/ui/Chip';
import { showToast } from '@/components/ui/Toast';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useAuthStore } from '@/store/useAuthStore';
import { useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { formatEntryDate } from '../journalDisplay';
import type { JournalEntry } from '../journalModel';
import { BOOK_LAYOUTS, bookCandidates, bookEntries, buildBookHtml, canGenerate, cleanBookTitle, dateRange, MAX_BOOK_ENTRIES, MIN_BOOK_ENTRIES, reviewItems, sortForBook, TITLE_MAX, toggleBookSelection, validSelection, type BookLayout, type BookPage, type BookSort, type ReviewItem } from './memoryBookModel';
import { createPhotoCache, photoCacheValid, prepareMemoryBook, shareMemoryBook, type PhotoCache, type PreparedBook } from './memoryBookExport';
import { localFileExists, memoryBookSupported } from './memoryBookService';

/**
 * /journal/book - pick 3-20 of your own memories, a layout and a title,
 * and make a private PDF on this device. Journal text is OFF unless turned
 * on; notes are never rewritten. Nothing is uploaded or kept.
 */
export function MemoryBookScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const entries = useJournalStore((state) => state.entries);
  const supported = memoryBookSupported();
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<BookSort>('oldest');
  const [layout, setLayout] = useState<BookLayout>('classic');
  const [title, setTitle] = useState('');
  const [showRange, setShowRange] = useState(true);
  const [includeText, setIncludeText] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'select' | 'review'>('select');
  // Prepared book waiting for a missing-photo decision (before any sharing).
  const [pending, setPending] = useState<PreparedBook | null>(null);
  // Photo data prepared in THIS session, reused by "try again".
  const photoCache = useRef<PhotoCache | null>(null);
  // Any sign-in / sign-out / account switch (even back into the same account).
  const sessionKey = useAuthStore((state) => `${state.status}:${state.user?.id ?? ''}`);

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
    track('journal_memory_book_started');
  }, []);
  // Another session: the previous person's picks, review and prepared private
  // content (photo data, notes) are dropped at once.
  useEffect(() => {
    setSelected([]);
    setPhase('select');
    setPending(null);
    photoCache.current = null;
  }, [owner, sessionKey]);

  const candidates = useMemo(() => sortForBook(bookCandidates(entries), sort), [entries, sort]);
  const picked = validSelection(entries, selected);
  const ready = canGenerate(entries, picked);
  const chosen = bookEntries(entries, picked, sort);
  const hasPhotos = chosen.some((entry) => !!entry.photo);
  const fmt = (date: string) => formatEntryDate(date, language);

  const buildHtml = (book: readonly JournalEntry[]) => (pages: BookPage[]) => {
    const range = dateRange(book);
    return buildBookHtml({
      title: cleanBookTitle(title, t('memoryBook.defaultTitle')),
      subtitle: showRange && range ? (range.from === range.to ? fmt(range.from) : `${fmt(range.from)} - ${fmt(range.to)}`) : null,
      layout,
      pages,
      labels: { untitled: t('journal.untitled'), madeWith: t('memoryBook.madeWith') },
      language,
    });
  };

  async function share(book: PreparedBook) {
    setPending(null);
    setBusy(true);
    try {
      const outcome = await shareMemoryBook(book, buildHtml(book.entries), localDateKey());
      // A deliberate stop (account/session changed) is silent - no failure toast.
      if (outcome.status === 'failed') showToast(t('memoryBook.failed'));
    } finally {
      setBusy(false);
    }
  }

  /** Gather photos first; ask about missing ones BEFORE anything is shared. */
  async function prepare() {
    setConfirm(false);
    // Re-read: anything deleted meanwhile is dropped before generation.
    const book = bookEntries(useJournalStore.getState().entries, picked, sort);
    if (book.length < MIN_BOOK_ENTRIES) return;
    if (!photoCache.current || !photoCacheValid(photoCache.current)) photoCache.current = createPhotoCache();
    setBusy(true);
    let prepared: PreparedBook | null = null;
    try {
      const outcome = await prepareMemoryBook({ entries: book, includeText, layout, formatDate: fmt, cache: photoCache.current });
      if (outcome.status === 'ready') prepared = outcome.book;
    } finally {
      setBusy(false);
    }
    if (!prepared) return;
    if (prepared.missingPhotoIds.length > 0) setPending(prepared);
    else await share(prepared);
  }

  const signedIn = owner !== 'guest';
  const review: ReviewItem[] = phase === 'review' ? reviewItems(entries, picked, sort, includeText, localFileExists, signedIn) : [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('memoryBook.title')}
        </Text>
      </View>
      {!supported ? (
        <View style={[styles.content, styles.center]}>
          <Text style={styles.body}>{t('memoryBook.unsupported')}</Text>
          <Button label={t('common.back')} variant="secondary" onPress={onPressBack} />
        </View>
      ) : (
        phase === 'review' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <Text style={styles.reviewHeading} accessibilityRole="header">
            {t('memoryBook.reviewTitle')}
          </Text>
          {/* Honest scope: a check of the content, not the rendered pages. */}
          <Text style={styles.note}>{t('memoryBook.reviewNote')}</Text>
          <View style={styles.summary}>
            <SummaryLine label={t('memoryBook.bookTitle')} value={cleanBookTitle(title, t('memoryBook.defaultTitle'))} />
            <SummaryLine label={t('memoryBook.showRange')} value={showRange ? t('memoryBook.on') : t('memoryBook.off')} />
            <SummaryLine label={t('memoryBook.layout')} value={t(`memoryBook.layouts.${layout}`)} />
            <SummaryLine label={t('memoryBook.includeText')} value={includeText ? t('memoryBook.on') : t('memoryBook.off')} />
            <SummaryLine label={t('memoryBook.sort')} value={t(`memoryBook.sortBy.${sort}`)} />
          </View>
          <Text style={styles.counter}>{t('memoryBook.reviewCount', { count: review.length })}</Text>
          {review.map((item, index) => (
            <View key={item.id} style={styles.reviewItem} accessible accessibilityLabel={`${index + 1}. ${t('memoryBook.memoryA11y', { date: fmt(item.date) })}${item.title ? `, ${item.title}` : ''}. ${t(`memoryBook.photoState.${item.photo}`)}${item.notePreview ? `. ${item.notePreview}` : ''}`}>
              <Text style={styles.reviewIndex}>{index + 1}</Text>
              {item.thumbnailUri ? (
                <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPaper, styles.thumbIcon]}>
                  {item.photo === 'account' ? <CloudDownload size={18} color={colors.textSecondary} strokeWidth={2} /> : item.photo === 'missing' ? <ImageOff size={18} color={colors.textSecondary} strokeWidth={2} /> : null}
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.itemTitle}>{item.title || t('journal.untitled')}</Text>
                <Text style={styles.note}>{fmt(item.date)}</Text>
                {item.photo === 'account' || item.photo === 'missing' ? <Text style={styles.note}>{t(`memoryBook.photoState.${item.photo}`)}</Text> : null}
                {/* Text OFF: no note content anywhere in the review. */}
                {item.notePreview ? <Text style={styles.notePreview}>{item.notePreview}</Text> : null}
              </View>
            </View>
          ))}
          <Button label={t('memoryBook.create')} variant="accent" size="lg" block disabled={!ready || busy} loading={busy} onPress={() => (includeText || hasPhotos ? setConfirm(true) : void prepare())} />
          <Button label={t('memoryBook.backToSelection')} variant="secondary" block disabled={busy} onPress={() => setPhase('select')} />
        </ScrollView>
        ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.note}>{t('memoryBook.intro', { min: MIN_BOOK_ENTRIES, max: MAX_BOOK_ENTRIES })}</Text>

          <Text style={styles.label}>{t('memoryBook.bookTitle')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(value) => setTitle(value.slice(0, TITLE_MAX))}
            placeholder={t('memoryBook.defaultTitle')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('memoryBook.bookTitle')}
          />
          <Row label={t('memoryBook.showRange')} value={showRange} onChange={setShowRange} />
          <Row label={t('memoryBook.includeText')} value={includeText} onChange={setIncludeText} hint={t('memoryBook.includeTextHint')} />

          <View style={styles.chips} accessibilityRole="tablist" accessibilityLabel={t('memoryBook.layout')}>
            {BOOK_LAYOUTS.map((option) => (
              <Chip key={option} label={t(`memoryBook.layouts.${option}`)} selected={layout === option} onPress={() => setLayout(option)} accessibilityRole="tab" />
            ))}
          </View>
          <View style={styles.chips} accessibilityRole="tablist" accessibilityLabel={t('memoryBook.sort')}>
            {(['oldest', 'newest'] as BookSort[]).map((option) => (
              <Chip key={option} label={t(`memoryBook.sortBy.${option}`)} selected={sort === option} onPress={() => setSort(option)} accessibilityRole="tab" />
            ))}
          </View>

          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {t('memoryBook.counter', { count: picked.length, max: MAX_BOOK_ENTRIES })}
          </Text>
          {candidates.length < MIN_BOOK_ENTRIES ? <Text style={styles.note}>{t('memoryBook.notEnough', { min: MIN_BOOK_ENTRIES })}</Text> : null}
          {candidates.map((entry) => {
            const on = picked.includes(entry.id);
            const date = fmt(entry.date);
            return (
              <AnimatedPressable
                key={entry.id}
                style={[styles.item, on && styles.itemOn]}
                onPress={() => setSelected((current) => toggleBookSelection(validSelection(entries, current), entry.id))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !on && picked.length >= MAX_BOOK_ENTRIES }}
                accessibilityLabel={`${t('memoryBook.memoryA11y', { date })}${entry.title ? `, ${entry.title}` : ''}, ${on ? t('memoryBook.selected') : t('memoryBook.notSelected')}`}
              >
                {entry.photo?.localUri ? <Image source={{ uri: entry.photo.localUri }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPaper]} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {entry.title || t('journal.untitled')}
                  </Text>
                  <Text style={styles.note}>{date}</Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={colors.textOnPrimary} strokeWidth={3} /> : null}</View>
              </AnimatedPressable>
            );
          })}

          <Button label={t('memoryBook.review')} variant="accent" size="lg" block disabled={!ready || busy} onPress={() => setPhase('review')} />
          <Text style={styles.note}>{t('memoryBook.localOnly')}</Text>
        </ScrollView>
        )
      )}
      <ConfirmationModal
        visible={confirm}
        title={t('memoryBook.privacyTitle')}
        message={t('memoryBook.privacyMessage')}
        confirmLabel={t('memoryBook.continue')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void prepare()}
        onCancel={() => setConfirm(false)}
      />
      {/* Missing photos are decided BEFORE anything is shared. */}
      <ConfirmationModal
        visible={!!pending}
        title={t('memoryBook.missingTitle', { count: pending?.missingPhotoIds.length ?? 0 })}
        message={t('memoryBook.missingMessage')}
        confirmLabel={t('memoryBook.continueWithout')}
        cancelLabel={t('memoryBook.tryAgain')}
        onConfirm={() => pending && void share(pending)}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.note}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, flex: 1, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  body: { ...textStyles.body, textAlign: 'center', color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textMuted },
  label: { ...typography.overline, color: colors.accentTerracotta },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  rowLabel: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  counter: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated },
  itemOn: { borderColor: colors.primary },
  thumb: { width: 52, height: 52, borderRadius: cardRadii.compact },
  thumbPaper: { backgroundColor: colors.surfaceAlt },
  itemTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  reviewHeading: { ...typography.h2, color: colors.textPrimary },
  summary: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  // Wraps under large text instead of truncating.
  summaryLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs },
  summaryLabel: { ...textStyles.small, color: colors.textSecondary, flexShrink: 1 },
  summaryValue: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  reviewItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.xs, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated },
  reviewIndex: { ...textStyles.small, fontWeight: '700', color: colors.textMuted, minWidth: 18, paddingTop: 2 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  notePreview: { ...textStyles.small, color: colors.textSecondary, fontStyle: 'italic' },
});
