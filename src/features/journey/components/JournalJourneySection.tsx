import { router } from 'expo-router';
import { ChevronRight, Lock, NotebookPen } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { formatEntryDate, linkArtwork } from '@/features/journal/journalDisplay';
import { visibleEntries } from '@/features/journal/journalModel';
import type { SupportedLanguage } from '@/i18n';
import { useJournalStore } from '@/store/useJournalStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

const LATEST = 2;

/**
 * "My Journal" in My Journey: how many private memories are saved and the
 * latest one or two. Personal content, not progress - it never counts
 * toward Passport, completion or achievements.
 */
export function JournalJourneySection({ editorial }: { editorial: boolean }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const entries = useJournalStore((state) => state.entries);
  const shown = useMemo(() => visibleEntries(entries), [entries]);

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, editorial && styles.editorial]}>{t('journal.journeyTitle')}</Text>
        <Lock size={14} color={colors.textMuted} strokeWidth={2.25} accessibilityLabel={t('journal.privateBadge')} />
      </View>
      <AnimatedPressable
        style={styles.summary}
        onPress={() => router.push('/journal' as never)}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={`${t('journal.open')}. ${shown.length > 0 ? t('journal.journeyCount', { count: shown.length }) : t('journal.journeyEmpty')}`}
      >
        <NotebookPen size={20} color={colors.primary} strokeWidth={2} />
        <Text style={styles.summaryText}>{shown.length > 0 ? t('journal.journeyCount', { count: shown.length }) : t('journal.journeyEmpty')}</Text>
        <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
      </AnimatedPressable>
      {shown.slice(0, LATEST).map((entry) => {
        const photo = entry.photo?.localUri ? { uri: entry.photo.localUri } : linkArtwork(entry.link);
        const title = entry.title || entry.link?.label || t('journal.untitled');
        const date = formatEntryDate(entry.date, language);
        return (
          <AnimatedPressable
            key={entry.id}
            style={styles.row}
            onPress={() => router.push(`/journal/${entry.id}` as never)}
            hoverEffect
            accessibilityRole="button"
            accessibilityLabel={t('journal.entryA11y', { title, date })}
          >
            {photo ? <Image source={photo} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, editorial && styles.editorial]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.rowDate}>{date}</Text>
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...typography.h1, color: colors.textPrimary },
  editorial: { fontFamily: fontFamily.wordmark },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  summaryText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface },
  thumb: { width: 44, height: 44, borderRadius: radii.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowDate: { ...typography.small, fontWeight: '500', color: colors.textMuted },
});
