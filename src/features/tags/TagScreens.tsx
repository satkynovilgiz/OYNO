import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Tag as TagIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useOymoCreations } from '@/services/content/oymoCreationsService';
import { ownerBoards, useDiscoveryBoardStore } from '@/store/useDiscoveryBoardStore';
import { ownerNotebook, useListeningNotebookStore } from '@/store/useListeningNotebookStore';
import { ownerQuestions, useQuestionsStore } from '@/store/useQuestionsStore';
import { ownerScrapbooks, useScrapbookStore } from '@/store/useScrapbookStore';
import { ownerBookmarks, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';
import { ownerTags, useTagsStore } from '@/store/useTagsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { newTagId, refKey, sortedTags, TAG_TYPES, tagRoute, tagsOf, type RecordRef, type TagRecordType } from './tagsModel';

function useTags() {
  const owner = useRecordsOwner();
  const status = useTagsStore((s) => s.status);
  const raw = useTagsStore((s) => s.saved[owner]);
  const data = useMemo(() => ownerTags({ [owner]: raw } as never, owner), [owner, raw]);
  useEffect(() => {
    void useTagsStore.getState().load();
  }, []);
  return { owner, status, data };
}

type Resolved = { status: 'ok'; title: string; route: string } | { status: 'missing' | 'loading' };

/** Reads each referenced record from its OWN store, for the current owner only (nothing copied). */
function useResolver(owner: string): (ref: RecordRef) => Resolved {
  const bookmarks = useSectionBookmarksStore((s) => s);
  const questions = useQuestionsStore((s) => s);
  const notebook = useListeningNotebookStore((s) => s);
  const scrapbooks = useScrapbookStore((s) => s);
  const boards = useDiscoveryBoardStore((s) => s);
  const designs = useOymoCreations();
  useEffect(() => {
    void useSectionBookmarksStore.getState().load();
    void useQuestionsStore.getState().load();
    void useListeningNotebookStore.getState().load();
    void useScrapbookStore.getState().load();
    void useDiscoveryBoardStore.getState().load();
  }, []);
  return (ref) => {
    const ready = (status: string) => status === 'ready';
    switch (ref.type) {
      case 'note': {
        if (!ready(bookmarks.status)) return { status: 'loading' };
        const b = ownerBookmarks(bookmarks.saved, owner)[ref.id];
        return b ? { status: 'ok', title: `${b.articleTitle} - ${b.sectionLabel}`, route: b.contentType === 'culture_item' ? `/culture/item/${encodeURIComponent(b.contentId)}?section=${encodeURIComponent(b.sectionKey)}` : '/profile/reading-notes' } : { status: 'missing' };
      }
      case 'question': {
        if (!ready(questions.status)) return { status: 'loading' };
        const q = ownerQuestions(questions.saved, owner)[ref.id];
        return q ? { status: 'ok', title: q.text, route: `/profile/questions/${encodeURIComponent(q.id)}` } : { status: 'missing' };
      }
      case 'moment': {
        if (!ready(notebook.status)) return { status: 'loading' };
        const m = ownerNotebook(notebook.saved, owner)[ref.id];
        return m ? { status: 'ok', title: m.note || m.titleSnapshot, route: `/culture/komuz/listen?resumeTrack=${encodeURIComponent(m.trackId)}&at=${Math.floor(m.seconds)}` } : { status: 'missing' };
      }
      case 'scrapbook': {
        if (!ready(scrapbooks.status)) return { status: 'loading' };
        const b = ownerScrapbooks(scrapbooks.saved, owner).find((x) => x.id === ref.id);
        return b ? { status: 'ok', title: b.title, route: `/profile/scrapbooks/${encodeURIComponent(b.id)}` } : { status: 'missing' };
      }
      case 'board': {
        if (!boards.isLoaded) return { status: 'loading' };
        const b = ownerBoards(boards.saved, owner).find((x) => x.id === ref.id);
        return b ? { status: 'ok', title: b.title, route: `/culture/board/${encodeURIComponent(b.id)}` } : { status: 'missing' };
      }
      case 'design': {
        if (owner === 'guest') return { status: 'missing' };
        if (!designs.data) return designs.isError ? { status: 'missing' } : { status: 'loading' };
        const d = designs.data.find((x) => x.id === ref.id);
        return d ? { status: 'ok', title: d.name || '', route: `/culture/oymo/create?creation=${encodeURIComponent(d.id)}` } : { status: 'missing' };
      }
    }
  };
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

/* ---------- on a record: choose its tags ---------- */

export function TagPicker({ recordRef }: { recordRef: RecordRef }) {
  const { t } = useTranslation();
  const { owner, status, data } = useTags();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const shownOwner = useRef(owner);
  useEffect(() => {
    shownOwner.current = owner;
    setOpen(false);
    setFailed(false);
  }, [owner]);
  const mine = tagsOf(data, recordRef);
  const run = async (change: Parameters<ReturnType<typeof useTagsStore.getState>['change']>[1]) => {
    const startedFor = owner;
    const ok = await useTagsStore.getState().change(startedFor, change);
    if (shownOwner.current !== startedFor) return false;
    setFailed(!ok);
    return ok;
  };
  const create = async () => {
    const id = newTagId();
    if ((await run({ type: 'create', id, name, now: new Date().toISOString() })) && (await run({ type: 'attach', id, ref: recordRef }))) {
      setName('');
      announce(t('tags.attached'));
    }
  };
  if (status !== 'ready') return null;
  return (
    <View style={styles.picker} testID="tag-picker">
      <View style={styles.wrap}>
        <TagIcon size={14} color={colors.textSecondary} strokeWidth={2} />
        {mine.length ? mine.map((tag) => (
          <Text key={tag.id} style={styles.tagChip}>
            {tag.name}
          </Text>
        )) : <Text style={styles.meta}>{t('tags.none')}</Text>}
        <Button label={open ? t('tags.done') : t('tags.edit')} variant="text" size="sm" onPress={() => setOpen(!open)} testID="tag-picker-toggle" />
      </View>
      {open ? (
        <View style={styles.stack}>
          <Text style={styles.meta}>{t('tags.personalNote')}</Text>
          {sortedTags(data).map((tag) => {
            const on = mine.some((m) => m.id === tag.id);
            return (
              <AnimatedPressable key={tag.id} style={[styles.check, on && styles.checkOn]} onPress={() => void run(on ? { type: 'detach', id: tag.id, ref: recordRef } : { type: 'attach', id: tag.id, ref: recordRef })} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} testID={`tag-option-${tag.name}`}>
                <Text style={[styles.checkText, on && styles.checkTextOn]}>{tag.name}</Text>
              </AnimatedPressable>
            );
          })}
          <TextField label={t('tags.newTag')} value={name} onChangeText={setName} placeholder={t('tags.newPlaceholder')} testID="tag-new-name" />
          <Button label={t('tags.createAttach')} size="sm" disabled={!name.trim()} onPress={create} testID="tag-create" />
          {failed ? <Text style={styles.warn}>{t('tags.failed')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- /profile/tags ---------- */

export function TagsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status, data } = useTags();
  return (
    <View style={styles.root}>
      <Header title={t('tags.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="tags">
        <Text style={styles.body}>{t('tags.intro')}</Text>
        <Text style={styles.note}>{t('tags.storage')}</Text>
        {status === 'error' ? (
          <View style={styles.stack}>
            <Text style={styles.warn}>{t('tags.loadError')}</Text>
            <Button label={t('common.retry')} onPress={() => void useTagsStore.getState().retryLoad()} />
          </View>
        ) : null}
        {status === 'ready' && sortedTags(data).length === 0 ? <Text style={styles.meta}>{t('tags.noneYet')}</Text> : null}
        {sortedTags(data).map((tag) => (
          <AnimatedPressable key={tag.id} style={styles.card} onPress={() => router.push(tagRoute(tag.id) as never)} accessibilityRole="button" testID={`tag-${tag.name}`}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, styles.flex]}>{tag.name}</Text>
              <Text style={styles.meta}>{t('tags.count', { count: (data.refs[tag.id] ?? []).length })}</Text>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ---------- /profile/tags/[tagId] ---------- */

export function TagDetailScreen({ tagId, onPressBack }: { tagId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { owner, status, data } = useTags();
  const resolve = useResolver(owner);
  const [filter, setFilter] = useState<TagRecordType | 'all'>('all');
  const [rename, setRename] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  const tag = data.tags[tagId] ?? null;
  const refs = data.refs[tagId] ?? [];
  const run = async (change: Parameters<ReturnType<typeof useTagsStore.getState>['change']>[1], done?: () => void) => {
    const ok = await useTagsStore.getState().change(owner, change);
    setFailed(!ok);
    if (ok) done?.();
    return ok;
  };

  if (status !== 'ready' || !tag) {
    return (
      <View style={styles.root}>
        <Header title={t('tags.title')} onPressBack={onPressBack} />
        <View style={styles.content}>{status === 'ready' ? <Text style={styles.body} testID="tag-not-found">{t('tags.notFound')}</Text> : <Text style={styles.meta}>{t('tags.loading')}</Text>}</View>
      </View>
    );
  }
  const shown = refs.filter((ref) => filter === 'all' || ref.type === filter);
  const others = sortedTags(data).filter((x) => x.id !== tag.id);

  return (
    <View style={styles.root}>
      <Header title={tag.name} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled" testID="tag-detail">
        <Text style={styles.note}>{t('tags.personalNote')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('tags.filter')}>
          {(['all', ...TAG_TYPES] as const).map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, filter === option && styles.chipOn]} onPress={() => setFilter(option)} accessibilityRole="radio" accessibilityState={{ checked: filter === option }} aria-checked={filter === option} testID={`tag-filter-${option}`}>
              <Text style={[styles.chipText, filter === option && styles.chipTextOn]}>{t(`tags.types.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {shown.length === 0 ? <Text style={styles.meta}>{t('tags.empty')}</Text> : null}
        {shown.map((ref) => {
          const r = resolve(ref);
          return (
            <View key={refKey(ref)} style={styles.card} testID={`tag-record-${ref.type}-${ref.id}`}>
              <Text style={styles.label}>{t(`tags.types.${ref.type}`)}</Text>
              {r.status === 'ok' ? <Text style={styles.cardTitle}>{r.title || t('tags.untitled')}</Text> : null}
              {r.status === 'loading' ? <Text style={styles.meta}>{t('tags.loading')}</Text> : null}
              {r.status === 'missing' ? <Text style={styles.warn}>{t('tags.missing')}</Text> : null}
              <View style={styles.wrap}>
                {r.status === 'ok' ? <Button label={t('tags.open')} variant="secondary" size="sm" onPress={() => router.push(r.route as never)} testID={`tag-open-${ref.type}-${ref.id}`} /> : null}
                <Button label={t('tags.removeRef')} variant="text" size="sm" onPress={() => void run({ type: 'detach', id: tag.id, ref })} testID={`tag-detach-${ref.type}-${ref.id}`} />
              </View>
            </View>
          );
        })}

        <Text style={styles.section} accessibilityRole="header">
          {t('tags.manage')}
        </Text>
        {rename === null ? (
          <Button label={t('tags.rename')} variant="secondary" size="sm" onPress={() => setRename(tag.name)} testID="tag-rename" />
        ) : (
          <View style={styles.stack}>
            <TextField label={t('tags.newName')} value={rename} onChangeText={setRename} testID="tag-rename-field" />
            <View style={styles.wrap}>
              <Button label={t('tags.saveName')} size="sm" disabled={!rename.trim()} onPress={() => void run({ type: 'rename', id: tag.id, name: rename }, () => setRename(null))} testID="tag-rename-save" />
              <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setRename(null)} />
            </View>
          </View>
        )}
        {others.length ? (
          merging ? (
            <View style={styles.stack} testID="tag-merge">
              <Text style={styles.meta}>{t('tags.mergeInto', { name: tag.name })}</Text>
              {others.map((other) => (
                <Button key={other.id} label={other.name} variant="secondary" size="sm" onPress={() => void run({ type: 'merge', from: tag.id, into: other.id }, () => router.replace(tagRoute(other.id) as never))} testID={`tag-merge-into-${other.name}`} />
              ))}
              <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setMerging(false)} />
            </View>
          ) : (
            <Button label={t('tags.merge')} variant="secondary" size="sm" onPress={() => setMerging(true)} testID="tag-merge-open" />
          )
        ) : null}
        {confirmDelete ? (
          <View style={styles.confirm} testID="tag-delete-confirm">
            <Text style={styles.body}>{t('tags.deleteConfirm', { name: tag.name })}</Text>
            <View style={styles.wrap}>
              <Button label={t('tags.deleteYes')} size="sm" onPress={() => void run({ type: 'delete', id: tag.id }, () => router.replace('/profile/tags' as never))} testID="tag-delete-yes" />
              <Button label={t('common.cancel')} variant="text" size="sm" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('tags.delete')} variant="text" onPress={() => setConfirmDelete(true)} testID="tag-delete" />
        )}
        {failed ? <Text style={styles.warn} accessibilityLiveRegion="polite" testID="tag-failed">{t('tags.failed')}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.xs },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...textStyles.overline, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  confirm: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  picker: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle },
  tagChip: { ...textStyles.small, color: colors.textPrimary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  check: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface, alignSelf: 'flex-start' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  checkTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
