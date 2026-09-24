import { router } from 'expo-router';
import { ChevronLeft, Lock, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useJournalStore } from '@/store/useJournalStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { formatEntryDate, formatMonthHeading, linkArtwork } from './journalDisplay';
import { groupByMonth, visibleEntries, type JournalEntry, type JournalFilter } from './journalModel';

const FILTERS: JournalFilter[] = ['all', 'places', 'culture', 'trails'];

/**
 * /journal - "My Kyrgyzstan Journal": a calm, private timeline grouped by
 * month. Same entries for every age mode; only the presentation changes
 * (child: big simple "My Memories"; preteen: scrapbook; teen: clean;
 * adult: editorial travel journal). Not a feed: no likes, no public view.
 */
export function JournalScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const entries = useJournalStore((state) => state.entries);
  const [filter, setFilter] = useState<JournalFilter>('all');

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  const shown = useMemo(() => visibleEntries(entries, filter), [entries, filter]);
  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerText}>
          <Text style={[styles.title, isAdult && styles.editorial, isChild && styles.childTitle]} accessibilityRole="header">
            {isChild ? t('journal.childTitle') : t('journal.title')}
          </Text>
          <View style={styles.privateRow}>
            <Lock size={12} color={colors.textMuted} strokeWidth={2.25} />
            <Text style={styles.subtitle}>{t('journal.subtitle')}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <AnimatedPressable
          style={[styles.newButton, isChild && styles.newButtonChild]}
          onPress={() => router.push('/journal/new' as never)}
          pressScale={0.97}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={isChild ? t('journal.childNew') : t('journal.new')}
        >
          <Plus size={isChild ? 24 : 18} color={colors.textOnDark} strokeWidth={2.5} />
          <Text style={[styles.newButtonText, isChild && styles.newButtonTextChild]}>{isChild ? t('journal.childNew') : t('journal.new')}</Text>
        </AnimatedPressable>

        {!isChild ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => {
              const selected = option === filter;
              return (
                <AnimatedPressable
                  key={option}
                  style={[styles.filter, selected && styles.filterSelected]}
                  onPress={() => setFilter(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`journal.filters.${option}`)}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{t(`journal.filters.${option}`)}</Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        ) : null}

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, isAdult && styles.editorial]}>{t('journal.empty')}</Text>
            <Text style={styles.emptyBody}>{t('journal.emptyBody')}</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.month} style={styles.group}>
              <Text style={[styles.month, isAdult && styles.monthAdult]} accessibilityRole="header">
                {formatMonthHeading(group.month, language)}
              </Text>
              {group.entries.map((entry, index) => (
                <JournalEntryCard key={entry.id} entry={entry} experience={experience} index={index} language={language} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function JournalEntryCard({ entry, experience, index, language }: { entry: JournalEntry; experience: AgeExperience; index: number; language: SupportedLanguage }) {
  const { t } = useTranslation();
  const photo: ImageSourcePropType | null = entry.photo?.localUri ? { uri: entry.photo.localUri } : linkArtwork(entry.link);
  const title = entry.title || entry.link?.label || t('journal.untitled');
  const date = formatEntryDate(entry.date, language);
  const scrapbook = experience === 'preteen';
  const isChild = experience === 'child';

  return (
    <AnimatedPressable
      style={[styles.card, isChild && styles.cardChild, experience === 'adult' && styles.cardAdult]}
      onPress={() => router.push(`/journal/${entry.id}` as never)}
      pressScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={t('journal.entryA11y', { title, date })}
    >
      {photo ? (
        <View style={[styles.photoWrap, scrapbook && { transform: [{ rotate: index % 2 === 0 ? '-2.5deg' : '2deg' }] }]}>
          <Image source={photo} style={[styles.photo, isChild && styles.photoChild]} resizeMode="cover" accessibilityIgnoresInvertColors />
          {scrapbook ? <View style={styles.tape} /> : null}
        </View>
      ) : null}
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, experience === 'adult' && styles.editorial, isChild && styles.cardTitleChild]} numberOfLines={2}>
          {title}
        </Text>
        {entry.note && !isChild ? (
          <Text style={styles.cardNote} numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}
        <Text style={styles.cardMeta} numberOfLines={1}>
          {entry.link ? `${t(`journal.linkTypes.${entry.link.type}`)} · ` : ''}
          {date}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.h1, color: colors.textPrimary },
  childTitle: { fontSize: 28 },
  editorial: { fontFamily: fontFamily.wordmark },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitle: { ...typography.small, fontWeight: '500', color: colors.textMuted, flexShrink: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  newButtonChild: { minHeight: 64, borderRadius: radii.xxl },
  newButtonText: { ...typography.bodyBold, color: colors.textOnDark },
  newButtonTextChild: { fontSize: 20 },
  filters: { gap: spacing.xs },
  filter: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, flexShrink: 0 },
  filterSelected: { backgroundColor: colors.primary },
  filterText: { ...typography.caption, fontWeight: '600', color: colors.textPrimary },
  filterTextSelected: { color: colors.textOnDark },
  empty: { paddingVertical: spacing.xl, gap: spacing.xs, alignItems: 'center' },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  group: { gap: spacing.sm },
  month: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  monthAdult: { color: colors.accentGoldPressed, letterSpacing: 2 },
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surface },
  cardChild: { padding: spacing.md, borderRadius: radii.xxl },
  cardAdult: { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt, borderRadius: 0, paddingHorizontal: 0 },
  photoWrap: { alignSelf: 'flex-start' },
  photo: { width: 76, height: 76, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  photoChild: { width: 96, height: 96 },
  tape: { position: 'absolute', top: -6, left: 22, width: 32, height: 12, backgroundColor: 'rgba(232,185,61,0.55)', transform: [{ rotate: '-4deg' }] },
  cardText: { flex: 1, gap: 2, justifyContent: 'center' },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary },
  cardTitleChild: { fontSize: 19 },
  cardNote: { ...typography.caption, color: colors.textSecondary },
  cardMeta: { ...typography.small, fontWeight: '500', color: colors.textMuted },
});
