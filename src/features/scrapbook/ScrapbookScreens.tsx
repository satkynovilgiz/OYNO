import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { komuzTracks } from '@/features/culture/audioData';
import { contentRoute } from '@/features/culture/connections/connectionsData';
import { useConnectionContent } from '@/features/culture/connections/useConnectionContent';
import { clockTime } from '@/features/culture/komuz/listening/komuzQueue';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { TagPicker } from '@/features/tags/TagScreens';
import { announce } from '@/services/a11y/announce';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { useJournalStore } from '@/store/useJournalStore';
import { ownerNotebook, useListeningNotebookStore } from '@/store/useListeningNotebookStore';
import { ownerScrapbook, ownerScrapbooks, useScrapbookStore } from '@/store/useScrapbookStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { addEntry, CAPTION_MAX, ENTRY_KINDS, MAX_ENTRIES, moveEntry, newScrapbook, removeEntry, rename, resolveEntries, setCaption, TITLE_MAX, type EntryKind, type EntryRef, type Scrapbook, type SourceView } from './scrapbookModel';
import { LoadingState, StateMessage, StateScreen } from '@/components/state/ScreenState';

export const scrapbookRoute = (id: string) => `/profile/scrapbooks/${encodeURIComponent(id)}`;

/** Unsaved edits per owner + scrapbook (memory) - kept while a source is open. */
const drafts = draftMap<Scrapbook>('scrapbook');

function useScrapbooks() {
  const owner = useRecordsOwner();
  const status = useScrapbookStore((state) => state.status);
  const saved = useScrapbookStore((state) => state.saved);
  useEffect(() => {
    void useScrapbookStore.getState().load();
  }, []);
  return { owner, status, saved };
}

/** The current owner's EXISTING records, as live sources (nothing copied). */
function useSources(owner: string) {
  const { t } = useTranslation();
  const content = useConnectionContent();
  const journalLoaded = useJournalStore((state) => state.isLoaded);
  const journal = useJournalStore((state) => state.entries);
  const designs = useOymoCreations();
  const notebookStatus = useListeningNotebookStore((state) => state.status);
  const notebook = ownerNotebook(useListeningNotebookStore((state) => state.saved), owner);
  useEffect(() => {
    void useJournalStore.getState().load();
    void useListeningNotebookStore.getState().load();
  }, []);
  const liveJournal = journal.filter((entry) => !entry.deletedAt);
  const resolve = (ref: EntryRef): SourceView => {
    switch (ref.kind) {
      case 'article': {
        if (content.isLoading) return undefined;
        const target = content.get(ref.contentType, ref.id);
        return target ? { title: target.title, detail: t(`scrapbook.kinds.article`), route: contentRoute(ref.contentType, ref.id) } : null;
      }
      case 'journal': {
        if (!journalLoaded) return undefined;
        const entry = liveJournal.find((candidate) => candidate.id === ref.id);
        return entry ? { title: entry.title || entry.date, detail: entry.note.slice(0, 160) || null, route: `/journal/${entry.id}` } : null;
      }
      case 'design': {
        if (designs.isLoading) return undefined;
        const design = designs.data?.find((row) => row.id === ref.id);
        return design ? { title: design.name || t('scrapbook.untitledDesign'), detail: t('scrapbook.motifs', { count: design.layers.length }), route: `/culture/oymo/create?creation=${encodeURIComponent(design.id)}` } : null;
      }
      case 'moment': {
        if (notebookStatus !== 'ready') return notebookStatus === 'error' ? null : undefined;
        const moment = notebook[ref.id];
        const track = moment ? komuzTracks.find((entry) => entry.id === moment.trackId) : null;
        if (!moment || !track) return null;
        return { title: `${track.title} · ${clockTime(moment.seconds)}`, detail: moment.note || null, route: `/culture/komuz/listen?resumeTrack=${encodeURIComponent(track.id)}&at=${Math.floor(moment.seconds)}` };
      }
    }
  };
  // Candidates to add, per kind (titles from the live records).
  const candidates: Record<EntryKind, { ref: EntryRef; title: string }[]> = {
    article: content.all().map((target) => ({ ref: { kind: 'article', contentType: target.type, id: target.id }, title: target.title })),
    journal: liveJournal.map((entry) => ({ ref: { kind: 'journal', id: entry.id }, title: entry.title || entry.date })),
    design: (designs.data ?? []).map((row) => ({ ref: { kind: 'design', id: row.id }, title: row.name || t('scrapbook.untitledDesign') })),
    moment: Object.values(notebook).flatMap((moment) => {
      const track = komuzTracks.find((entry) => entry.id === moment.trackId);
      return track ? [{ ref: { kind: 'moment' as const, id: moment.id }, title: `${track.title} · ${clockTime(moment.seconds)}` }] : [];
    }),
  };
  return { resolve, candidates };
}

function Header({ title, onPressBack }: { title: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

/** /profile/scrapbooks */
export function ScrapbookListScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, saved } = useScrapbooks();
  const [title, setTitle] = useState('');
  const [failed, setFailed] = useState(false);
  const create = async () => {
    const book = newScrapbook(title);
    if (!(await useScrapbookStore.getState().save(owner, book))) return setFailed(true);
    setFailed(false);
    setTitle('');
    router.push(scrapbookRoute(book.id) as never);
  };
  return (
    <View style={styles.root}>
      <Header title={t('scrapbook.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="scrapbook-list">
        <Text style={styles.body}>{t('scrapbook.intro', { max: MAX_ENTRIES })}</Text>
        <Text style={styles.note}>{t('scrapbook.liveNote')}</Text>
        {status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('scrapbook.loadError')}</Text>
            <Button label={t('scrapbook.retry')} size="sm" onPress={() => void useScrapbookStore.getState().retryLoad()} />
          </View>
        ) : null}
        <View style={styles.card}>
          <TextField testID="scrapbook-new-title" label={t('scrapbook.titleLabel')} value={title} onChangeText={(value) => setTitle(value.slice(0, TITLE_MAX))} />
          {failed ? <Text style={styles.warn}>{t('scrapbook.saveFailed')}</Text> : null}
          <Button label={failed ? t('scrapbook.retry') : t('scrapbook.create')} disabled={status !== 'ready' || !title.trim()} onPress={() => void create()} testID="scrapbook-create" />
        </View>
        {ownerScrapbooks(saved, owner).map((book) => (
          <AnimatedPressable key={book.id} style={styles.row} onPress={() => router.push(scrapbookRoute(book.id) as never)} accessibilityRole="button" testID={`scrapbook-open-${book.id}`}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{book.title || t('scrapbook.untitled')}</Text>
              <Text style={styles.meta}>{t('scrapbook.entryCount', { count: book.entries.length })}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </AnimatedPressable>
        ))}
        <Text style={styles.meta}>{t('scrapbook.storageNote')}</Text>
      </ScrollView>
    </View>
  );
}

/** /profile/scrapbooks/[id] - edit (add, arrange, captions) and read page by page. */
export function ScrapbookScreen({ bookId, onPressBack }: { bookId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, saved } = useScrapbooks();
  const { resolve, candidates } = useSources(owner);
  const key = ownerKey(owner, bookId);
  const [draft, setDraftState] = useState<Scrapbook | null>(() => drafts.get(key) ?? null);
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    setDraftState(drafts.get(key) ?? null);
  }, [key]);
  const [mode, setMode] = useState<'edit' | 'read'>('edit');
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<EntryKind>('article');
  const [search, setSearch] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // A failed load is not "not found", and loading is never a blank screen.
  if (status === 'error')
    return (
      <StateScreen onPressBack={onPressBack} testID="scrapbook-state-error">
        <StateMessage kind="error" title={t('scrapbook.loadError')} body={t('states.recordsErrorBody')} action={{ label: t('scrapbook.retry'), onPress: () => void useScrapbookStore.getState().retryLoad(), testID: 'scrapbook-detail-retry' }} />
      </StateScreen>
    );
  if (status !== 'ready')
    return (
      <StateScreen onPressBack={onPressBack} testID="scrapbook-state-loading">
        <LoadingState label={t('scrapbook.loading')} onRetry={() => void useScrapbookStore.getState().retryLoad()} />
      </StateScreen>
    );
  const stored = ownerScrapbook(saved, owner, bookId);
  const book = draft ?? stored;
  if (!book) return <NotFoundState onPressBack={onPressBack} />;
  const edit = (next: Scrapbook) => {
    drafts.set(key, next);
    setDraftState(next);
  };
  /**
   * Saves what is on screen NOW. If more edits are made while it is being
   * written, they are kept (the draft is only cleared when nothing changed
   * since this save started).
   */
  const save = async () => {
    const sent = book;
    const startedKey = key;
    setBusy(true);
    const ok = await useScrapbookStore.getState().save(owner, sent);
    setBusy(false);
    if (shownKey.current !== startedKey) return;
    if (!ok) {
      setFailed(true);
      announce(t('scrapbook.saveFailed'));
      return;
    }
    setFailed(false);
    if (drafts.get(startedKey) === sent || !drafts.has(startedKey)) {
      drafts.delete(startedKey);
      setDraftState(null);
    }
    announce(t('scrapbook.saved'));
  };

  const entries = resolveEntries(book, resolve);
  const query = search.trim().toLowerCase();
  const inBook = new Set(book.entries.map((entry) => entry.key));
  const options = candidates[kind].filter((candidate) => !inBook.has(candidateKey(candidate.ref)) && (kind !== 'article' ? true : query.length >= 2 && candidate.title.toLowerCase().includes(query))).slice(0, 8);
  const full = book.entries.length >= MAX_ENTRIES;
  const current = entries[Math.min(page, Math.max(0, entries.length - 1))];

  const sourceBlock = (entry: (typeof entries)[number]) =>
    entry.status === 'ok' && entry.source ? (
      <View style={styles.source}>
        <Text style={styles.label}>{t(`scrapbook.kinds.${entry.ref.kind}`)}</Text>
        <Text style={styles.cardTitle}>{entry.source.title}</Text>
        {entry.source.detail ? <Text style={styles.meta}>{entry.source.detail}</Text> : null}
      </View>
    ) : (
      <View style={[styles.source, styles.placeholder]} testID={`scrapbook-missing-${entry.position}`}>
        <ImageOff size={16} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.cardTitle}>{entry.titleSnapshot || t(`scrapbook.kinds.${entry.ref.kind}`)}</Text>
        <Text style={styles.meta}>{entry.status === 'loading' ? t('scrapbook.loading') : t('scrapbook.missing')}</Text>
      </View>
    );
  const captionBlock = (caption: string) =>
    caption.trim() ? (
      <View style={styles.caption}>
        <Text style={styles.captionLabel}>{t('scrapbook.yourCaption')}</Text>
        <Text style={styles.body}>{caption}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <Header title={book.title || t('scrapbook.untitled')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="scrapbook-screen">
        <View style={styles.wrap} accessibilityRole="tablist">
          {(['edit', 'read'] as const).map((id) => (
            <AnimatedPressable key={id} style={[styles.chip, mode === id && styles.chipOn]} onPress={() => setMode(id)} accessibilityRole="tab" accessibilityState={{ selected: mode === id }} testID={`scrapbook-mode-${id}`}>
              <Text style={[styles.chipText, mode === id && styles.chipTextOn]}>{t(`scrapbook.modes.${id}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {mode === 'read' ? (
          entries.length === 0 || !current ? (
            <Text style={styles.body}>{t('scrapbook.empty')}</Text>
          ) : (
            <View style={styles.stack} testID="scrapbook-read">
              <Text style={styles.meta} accessibilityLiveRegion="polite" testID="scrapbook-page">
                {t('scrapbook.pageOf', { count: entries.length, current: current.position + 1, total: entries.length })}
              </Text>
              {sourceBlock(current)}
              {captionBlock(current.caption)}
              {current.status === 'ok' && current.source ? <Button label={t('scrapbook.openSource')} variant="secondary" onPress={() => router.push(current.source!.route as never)} testID="scrapbook-open-source" /> : null}
              <View style={styles.wrap}>
                <Button label={t('scrapbook.previous')} variant="secondary" disabled={current.position === 0} onPress={() => setPage(current.position - 1)} testID="scrapbook-prev" />
                <Button label={t('scrapbook.next')} disabled={current.position >= entries.length - 1} onPress={() => setPage(current.position + 1)} testID="scrapbook-next" />
              </View>
            </View>
          )
        ) : (
          <View style={styles.stack} testID="scrapbook-edit">
            <TextField testID="scrapbook-title" label={t('scrapbook.titleLabel')} value={book.title} onChangeText={(value) => edit(rename(book, value))} />
            {stored ? <TagPicker recordRef={{ type: 'scrapbook', id: stored.id }} /> : null}
            <Text style={styles.section} accessibilityRole="header">
              {t('scrapbook.entriesTitle', { count: book.entries.length, max: MAX_ENTRIES })}
            </Text>
            {entries.map((entry, index) => (
              <View key={entry.key} style={styles.entry} testID={`scrapbook-entry-${index}`}>
                <View style={styles.flex}>
                  {sourceBlock(entry)}
                  <TextField testID={`scrapbook-caption-${index}`} label={t('scrapbook.captionLabel')} value={entry.caption} onChangeText={(value) => edit(setCaption(book, entry.key, value.slice(0, CAPTION_MAX)))} />
                  <Button label={t('scrapbook.remove')} variant="text" size="sm" onPress={() => edit(removeEntry(book, entry.key))} testID={`scrapbook-remove-${index}`} />
                </View>
                <View style={styles.move}>
                  <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('scrapbook.moveUp', { n: index + 1 })} onPress={() => edit(moveEntry(book, index, -1))} testID={`scrapbook-up-${index}`} />
                  <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === entries.length - 1} accessibilityLabel={t('scrapbook.moveDown', { n: index + 1 })} onPress={() => edit(moveEntry(book, index, 1))} testID={`scrapbook-down-${index}`} />
                </View>
              </View>
            ))}
            {full ? (
              <Text style={styles.meta}>{t('scrapbook.full', { max: MAX_ENTRIES })}</Text>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('scrapbook.add')}</Text>
                <View style={styles.wrap} accessibilityRole="radiogroup">
                  {ENTRY_KINDS.map((id) => (
                    <AnimatedPressable key={id} style={[styles.chip, kind === id && styles.chipOn]} onPress={() => setKind(id)} accessibilityRole="radio" accessibilityState={{ checked: kind === id }} aria-checked={kind === id} testID={`scrapbook-kind-${id}`}>
                      <Text style={[styles.chipText, kind === id && styles.chipTextOn]}>{t(`scrapbook.kinds.${id}`)}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                {kind === 'article' ? <TextField testID="scrapbook-search" label={t('scrapbook.search')} value={search} onChangeText={setSearch} placeholder={t('scrapbook.searchPlaceholder')} /> : null}
                {kind !== 'article' && candidates[kind].length === 0 ? <Text style={styles.meta}>{t(`scrapbook.none.${kind}`)}</Text> : null}
                {options.map((candidate) => (
                  <AnimatedPressable key={candidateKey(candidate.ref)} style={styles.row} onPress={() => { edit(addEntry(book, candidate.ref, candidate.title)); setSearch(''); }} accessibilityRole="button" accessibilityLabel={t('scrapbook.addNamed', { name: candidate.title })} testID={`scrapbook-add-${candidate.ref.id}`}>
                    <Text style={[styles.body, styles.flex]}>+ {candidate.title}</Text>
                  </AnimatedPressable>
                ))}
                <Text style={styles.meta}>{t('scrapbook.noCapsules')}</Text>
              </View>
            )}
            {failed ? (
              <Text style={styles.warn} accessibilityLiveRegion="polite" testID="scrapbook-save-failed">
                {t('scrapbook.saveFailed')}
              </Text>
            ) : null}
            <Button label={failed ? t('scrapbook.retry') : t('scrapbook.save')} disabled={busy || !draft} onPress={() => void save()} testID="scrapbook-save" />
            {draft ? <Text style={styles.meta} testID="scrapbook-unsaved">{t('scrapbook.unsaved')}</Text> : null}
          </View>
        )}
        <Text style={styles.meta}>{t('scrapbook.storageNote')}</Text>
      </ScrollView>
    </View>
  );
}

const candidateKey = (ref: EntryRef) => (ref.kind === 'article' ? `article:${ref.contentType}:${ref.id}` : `${ref.kind}:${ref.id}`);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1, gap: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { ...typography.overline, color: colors.textSecondary },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  entry: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  move: { gap: spacing.xs },
  source: { gap: 2, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.primary },
  placeholder: { borderLeftColor: colors.border, backgroundColor: colors.surfaceMuted },
  caption: { gap: 2, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentBrown },
  captionLabel: { ...textStyles.overline, color: colors.accentBrownDark },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
