import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui';
import { renderedSectionKeys, sectionLabelKey } from '@/features/culture/itemSections';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { ownerBookmarks, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { bookmarkRoute, bookmarkStatus, listBookmarks, type SectionBookmark } from './sectionBookmarks';

/**
 * /profile/reading-notes - your bookmarked article sections and notes.
 * Article information (title, section) is shown apart from your words.
 * Missing articles or sections keep the note, say so, and can be deleted.
 * Uses the app's cached article list, so it works offline.
 */
export function ReadingNotesScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const status = useSectionBookmarksStore((state) => state.status);
  const saved = useSectionBookmarksStore((state) => state.saved);
  const items = useAllCultureItems();
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    void useSectionBookmarksStore.getState().load();
  }, []);
  useEffect(() => setFailed(null), [owner]);

  const entries = listBookmarks(ownerBookmarks(saved, owner));
  const articleOf = (bookmark: SectionBookmark) => {
    if (bookmark.contentType !== 'culture_item') return null;
    if (!items.data) return null; // not known yet
    const item = items.data.find((row) => row.id === bookmark.contentId);
    return item ? { exists: true, title: item.title, sections: renderedSectionKeys(item) } : { exists: false, title: null, sections: null };
  };
  const remove = async (key: string) => {
    const ok = await useSectionBookmarksStore.getState().remove(owner, key);
    setFailed(ok ? null : key);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('readingCompanion.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="reading-notes">
        <Text style={styles.meta}>{t('readingCompanion.intro')}</Text>
        {status === 'error' ? (
          <View style={styles.card} testID="reading-notes-error">
            <Text style={styles.body}>{t('readingCompanion.loadError')}</Text>
            <Button label={t('readingCompanion.retry')} onPress={() => void useSectionBookmarksStore.getState().retryLoad()} />
          </View>
        ) : status !== 'ready' ? (
          <Text style={styles.meta}>{t('readingCompanion.loading')}</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.body} testID="reading-notes-empty">
            {t('readingCompanion.none')}
          </Text>
        ) : (
          entries.map(([key, bookmark]) => {
            const article = articleOf(bookmark);
            const state = bookmarkStatus(bookmark, article);
            const labelKey = sectionLabelKey(bookmark.sectionKey);
            const sectionLabel = state === 'ok' && labelKey ? t(labelKey) : bookmark.sectionLabel;
            return (
              <View key={key} style={styles.card} testID={`reading-note-${bookmark.contentId}-${bookmark.sectionKey}`}>
                <Text style={styles.label}>{t('readingCompanion.fromArticle')}</Text>
                <Text style={styles.cardTitle}>{article?.title ?? bookmark.articleTitle}</Text>
                <Text style={styles.meta}>{t('readingCompanion.section', { section: sectionLabel })}</Text>
                {state === 'articleMissing' ? <Text style={styles.warn} testID="reading-note-article-missing">{t('readingCompanion.articleMissing')}</Text> : null}
                {state === 'sectionMissing' ? <Text style={styles.warn} testID="reading-note-section-missing">{t('readingCompanion.sectionMissing')}</Text> : null}
                {bookmark.note ? (
                  <View style={styles.note}>
                    <Text style={styles.noteLabel}>{t('readingCompanion.yourNote')}</Text>
                    <Text style={styles.body}>{bookmark.note}</Text>
                  </View>
                ) : null}
                <View style={styles.row}>
                  {state === 'ok' || state === 'unknown' ? <Button label={t('readingCompanion.openSection')} size="sm" onPress={() => router.push(bookmarkRoute(bookmark) as never)} testID={`reading-note-open-${bookmark.sectionKey}`} /> : null}
                  {state === 'sectionMissing' ? <Button label={t('readingCompanion.openArticle')} variant="secondary" size="sm" onPress={() => router.push(`/culture/item/${bookmark.contentId}` as never)} /> : null}
                  <Button label={t('readingCompanion.deleteBookmark')} variant="text" size="sm" onPress={() => void remove(key)} testID={`reading-note-delete-${bookmark.sectionKey}`} />
                </View>
                {failed === key ? <Text style={styles.warn}>{t('readingCompanion.removeFailed')}</Text> : null}
              </View>
            );
          })
        )}
        <Text style={styles.meta}>{t('readingCompanion.storageNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  label: { ...textStyles.overline, color: colors.primary },
  noteLabel: { ...textStyles.overline, color: colors.accentBrownDark },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  note: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentBrown },
});
