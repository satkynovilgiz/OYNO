import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';
import { ownerBookmark, useSectionBookmarksStore } from '@/store/useSectionBookmarksStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { bookmarkKey } from '../reading/sectionBookmarks';
import { sourceExplorerRoute } from './sourceExplorer';
import { buildSourceLens, keepOpenLens, lensLink, openLensFor, type LensArticle, type PersonalNote } from './sourceLensModel';

/**
 * "About this information" under one article section (sourceLensModel.ts).
 * Opens in place - the article doesn't move - and remembers it was open
 * while a source or the article's Source Explorer is visited.
 */
export function SourceLensToggle({ article, sectionKey, sectionLabel }: { article: LensArticle; sectionKey: string; sectionLabel: string }) {
  const { t, i18n } = useTranslation();
  const owner = useRecordsOwner();
  const [open, setOpen] = useState(() => openLensFor(article.id) === sectionKey);
  const [linkFailed, setLinkFailed] = useState<string | null>(null);
  const bookmark = ownerBookmark(useSectionBookmarksStore((state) => state.saved), owner, bookmarkKey('culture_item', article.id, sectionKey));
  const highlights = ownerHighlights(useHighlightsStore((state) => state.saved), owner);
  useEffect(() => {
    void useSectionBookmarksStore.getState().load();
  }, []);
  const personal = useMemo<PersonalNote[]>(
    () => [
      ...(bookmark?.note ? [{ kind: 'bookmark' as const, note: bookmark.note }] : []),
      ...Object.values(highlights)
        .filter((h) => h.contentType === 'culture_item' && h.contentId === article.id && h.sectionKey === sectionKey && h.note)
        .map((h) => ({ kind: 'highlight' as const, note: h.note ?? '' })),
    ],
    [bookmark, highlights, article.id, sectionKey],
  );
  const lens = buildSourceLens(article, sectionKey, personal);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    keepOpenLens(article.id, next ? sectionKey : null);
  };
  const openLink = async (url: string, id: string) => {
    try {
      await Linking.openURL(url);
      setLinkFailed(null);
    } catch {
      setLinkFailed(id);
    }
  };
  const date = lens.textUpdatedAt ? new Intl.DateTimeFormat(i18n.language === 'kg' ? 'ky' : i18n.language, { dateStyle: 'long' }).format(new Date(lens.textUpdatedAt)) : null;

  return (
    <View style={styles.wrap}>
      <AnimatedPressable style={styles.toggle} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('sourceLens.toggleA11y', { section: sectionLabel })} testID={`source-lens-${sectionKey}`}>
        <Info size={14} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.toggleText}>{t('sourceLens.toggle')}</Text>
      </AnimatedPressable>
      {open ? (
        <View style={styles.panel} testID={`source-lens-panel-${sectionKey}`}>
          <Group title={t('sourceLens.articleText')}>
            <Text style={styles.body}>{t('sourceLens.articleTextBody', { status: t(`sources.status.${lens.level}`) })}</Text>
            {date ? <Text style={styles.meta}>{t('sourceLens.textUpdated', { date })}</Text> : null}
          </Group>

          <Group title={t('sourceLens.recorded')}>
            {lens.hasAttribution ? <Text style={styles.meta}>{t('sourceLens.wholeArticle')}</Text> : null}
            {lens.sources.length === 0 || !lens.hasAttribution ? (
              <Text style={styles.body} testID="source-lens-none">
                {t('sourceLens.notAvailable')}
              </Text>
            ) : null}
            {lens.sources.map((source, index) => {
              const url = lensLink(source);
              return source.kind === 'link' ? (
                <View key={source.id} style={styles.source} testID={`source-lens-source-${index}`}>
                  <Text style={styles.cardTitle}>{source.info.name}</Text>
                  <Text style={styles.meta}>
                    {t(`sources.kinds.${source.info.kind}`)} · {source.info.host}
                  </Text>
                  <Button label={t('sourceLens.open')} variant="text" size="sm" accessibilityHint={t('sourceLens.openHint')} onPress={() => void openLink(url!, source.id)} testID={`source-lens-open-${index}`} />
                  {linkFailed === source.id ? <Text style={styles.warn}>{t('sourceLens.openFailed')}</Text> : null}
                </View>
              ) : (
                <Text key={source.id} style={styles.meta} testID={`source-lens-unavailable-${index}`}>
                  {t('sourceLens.unavailableEntry')}
                </Text>
              );
            })}
            {lens.sources.length ? <Button label={t('sourceLens.explorer')} variant="text" size="sm" onPress={() => router.push(sourceExplorerRoute('culture_item', article.id) as never)} testID={`source-lens-explorer-${sectionKey}`} /> : null}
          </Group>

          <Group title={t('sourceLens.quotesTitle')}>
            {lens.excerpts.length ? (
              lens.excerpts.map((excerpt) => (
                <View key={excerpt.connectionId} style={styles.quote} testID="source-lens-excerpt">
                  <Text style={styles.body}>«{excerpt.evidence}»</Text>
                  <Text style={styles.meta}>{t('sourceLens.excerptNote')}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>{t('sourceLens.noExcerpts')}</Text>
            )}
            <Text style={styles.meta}>{t('sourceLens.noContributorQuotes')}</Text>
          </Group>

          {lens.personal.length ? (
            <Group title={t('sourceLens.personalTitle')}>
              <Text style={styles.meta}>{t('sourceLens.personalNote')}</Text>
              {lens.personal.map((entry, index) => (
                <Text key={index} style={styles.personal} testID="source-lens-personal">
                  {t(`sourceLens.personalKind.${entry.kind}`)}: {entry.note}
                </Text>
              ))}
            </Group>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.section} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  toggleText: { ...textStyles.small, color: colors.textSecondary },
  panel: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  group: { gap: 4 },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  source: { gap: 2 },
  quote: { gap: 2, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  personal: { ...textStyles.small, color: colors.textPrimary, fontStyle: 'italic', padding: spacing.xs, backgroundColor: colors.surfaceMuted, borderRadius: 6 },
});
