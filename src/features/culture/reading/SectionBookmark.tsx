import { Bookmark, BookmarkCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, TextField } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { ownerBookmark, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import type { ReadingContentType } from './readingModel';
import { bookmarkKey, NOTE_MAX } from './sectionBookmarks';

/**
 * Under one article section: bookmark it, with an optional note in your
 * own words. Saved only when the write succeeds; on failure the note stays
 * here with Retry (which saves what is in the field NOW).
 */
export function SectionBookmark({ contentType, contentId, sectionKey, sectionLabel, articleTitle }: { contentType: ReadingContentType; contentId: string; sectionKey: string; sectionLabel: string; articleTitle: string }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useSectionBookmarksStore((state) => state.status);
  const key = bookmarkKey(contentType, contentId, sectionKey);
  const saved = ownerBookmark(useSectionBookmarksStore((state) => state.saved), owner, key);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState<'save' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void useSectionBookmarksStore.getState().load();
  }, []);
  // Another account: nothing typed for the previous one stays.
  const shownOwner = useRef(owner);
  useEffect(() => {
    if (shownOwner.current === owner) return;
    shownOwner.current = owner;
    setOpen(false);
    setNote(null);
    setFailed(null);
  }, [owner]);

  const text = note ?? saved?.note ?? '';
  const save = async () => {
    setBusy(true);
    const startedFor = owner;
    const ok = await useSectionBookmarksStore.getState().save(startedFor, { contentType, contentId, sectionKey, articleTitle, sectionLabel, note: text });
    setBusy(false);
    // The account changed meanwhile: the result belongs to the previous account - nothing is shown here.
    if (shownOwner.current !== startedFor) return;
    if (!ok) {
      setFailed('save');
      announce(t('readingCompanion.saveFailed'));
      return;
    }
    setFailed(null);
    setNote(null);
    setOpen(false);
    announce(t('readingCompanion.savedAnnounce', { section: sectionLabel }));
  };
  const remove = async () => {
    setBusy(true);
    const startedFor = owner;
    const ok = await useSectionBookmarksStore.getState().remove(startedFor, key);
    setBusy(false);
    if (shownOwner.current !== startedFor) return;
    if (!ok) return setFailed('remove');
    setFailed(null);
    setNote(null);
    setOpen(false);
    announce(t('readingCompanion.removedAnnounce', { section: sectionLabel }));
  };

  return (
    <View style={styles.wrap}>
      <AnimatedPressable style={styles.toggle} onPress={() => setOpen((value) => !value)} disabled={status !== 'ready'} accessibilityRole="button" accessibilityState={{ expanded: open, disabled: status !== 'ready' }} accessibilityLabel={saved ? t('readingCompanion.bookmarkedA11y', { section: sectionLabel }) : t('readingCompanion.bookmarkA11y', { section: sectionLabel })} testID={`section-bookmark-${sectionKey}`}>
        {saved ? <BookmarkCheck size={14} color={colors.primary} strokeWidth={2.25} /> : <Bookmark size={14} color={colors.textSecondary} strokeWidth={2} />}
        <Text style={[styles.toggleText, saved && styles.toggleOn]}>{saved ? t('readingCompanion.bookmarked') : t('readingCompanion.bookmark')}</Text>
      </AnimatedPressable>
      {open ? (
        <View style={styles.panel} testID={`section-panel-${sectionKey}`}>
          <TextField testID={`section-note-${sectionKey}`} label={t('readingCompanion.noteLabel')} value={text} onChangeText={(value) => setNote(value.slice(0, NOTE_MAX))} multiline numberOfLines={3} placeholder={t('readingCompanion.notePlaceholder')} />
          <Text style={styles.meta}>{t('readingCompanion.noteNote')}</Text>
          {failed ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" testID={`section-save-failed-${sectionKey}`}>
              {t(failed === 'save' ? 'readingCompanion.saveFailed' : 'readingCompanion.removeFailed')}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Button label={failed === 'save' ? t('readingCompanion.retry') : saved ? t('readingCompanion.saveNote') : t('readingCompanion.saveBookmark')} size="sm" disabled={busy} onPress={() => void save()} testID={`section-save-${sectionKey}`} />
            {saved ? <Button label={t('readingCompanion.remove')} variant="text" size="sm" disabled={busy} onPress={() => void remove()} testID={`section-remove-${sectionKey}`} /> : null}
          </View>
        </View>
      ) : saved?.note ? (
        <View style={styles.saved} testID={`section-saved-${sectionKey}`}>
          <Text style={styles.label}>{t('readingCompanion.yourNote')}</Text>
          <Text style={styles.body}>{saved.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  toggleText: { ...textStyles.small, color: colors.textSecondary },
  toggleOn: { color: colors.primary, fontWeight: '700' },
  panel: { gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  saved: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentBrown },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  label: { ...textStyles.overline, color: colors.accentBrownDark },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  error: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
});
