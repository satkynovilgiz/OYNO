import { router } from 'expo-router';
import { ChevronLeft, Lock, NotebookPen, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryCompanion } from '@/components/companion/CompanionMoment';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { formatEntryDate, formatMonthHeading, linkArtwork } from './journalDisplay';
import { groupByMonth, visibleEntries, type JournalEntry, type JournalFilter, type JournalLink } from './journalModel';
import { LibraryEmptyState } from '@/components/library/LibraryChrome';
import { Chip } from '@/components/ui/Chip';

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

  const total = useMemo(() => visibleEntries(entries).length, [entries]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onPressBack} />
        </View>

        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <Text style={styles.eyebrow}>{t('journal.v2.eyebrow')}</Text>
          </View>
          <Text style={[styles.title, !isChild && styles.titleEditorial]} accessibilityRole="header">
            {isChild ? t('journal.childTitle') : t('journal.title')}
          </Text>
          <View style={styles.privateRow}>
            <Lock size={12} color={colors.textMuted} strokeWidth={2.25} />
            <Text style={styles.subtitle}>
              {t('journal.privateBadge')}
              {total > 0 ? ` · ${t('journal.v2.count', { count: total })}` : ''}
            </Text>
          </View>
        </View>

        {/* The one create action. */}
        <Button
          label={isChild ? t('journal.childNew') : t('journal.new')}
          icon={<Plus size={isChild ? 22 : 18} color={colors.textPrimary} strokeWidth={2.5} />}
          variant="accent"
          size={isChild ? 'lg' : 'md'}
          block
          onPress={() => router.push('/journal/new' as never)}
        />

        {!isChild && total > 0 ? (
          // Bleeds to the screen edges so the last chip scrolls fully into view.
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBleed} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => (
              <Chip key={option} label={t(`journal.filters.${option}`)} selected={option === filter} onPress={() => setFilter(option)} accessibilityRole="tab" />
            ))}
          </ScrollView>
        ) : null}

        {total === 0 ? <StoryCompanion surface="emptyJournal" moment="empty" /> : null}
        {groups.length === 0 ? (
          <LibraryEmptyState icon={NotebookPen} tone={colors.primary} title={t('journal.empty')} description={t('journal.emptyBody')} />
        ) : (
          groups.map((group) => (
            <View key={group.month} style={styles.group}>
              <Text style={[styles.month, isAdult && styles.monthAdult]} accessibilityRole="header">
                {formatMonthHeading(group.month, language)}
              </Text>
              {group.entries.map((entry, index) => (
                <MemoryCard key={entry.id} entry={entry} experience={experience} index={index} language={language} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** Linked OYNO content as a quiet pill with the content's own small
 * artwork - visibly separate from the user's photo. */
export function LinkedPill({ link }: { link: JournalLink }) {
  const { t } = useTranslation();
  const art = linkArtwork(link);
  return (
    <View style={styles.pill} accessible accessibilityLabel={`${t(`journal.linkTypes.${link.type}`)}: ${link.label}`}>
      {art ? <Image source={art} style={styles.pillThumb} resizeMode="cover" /> : <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />}
      <Text style={styles.pillText} numberOfLines={1}>
        {t(`journal.linkTypes.${link.type}`)} · {link.label}
      </Text>
    </View>
  );
}

/**
 * Two memory cards: PHOTO (the user's own picture, natural and un-darkened,
 * text below) and TEXT (warm paper surface, small ornament). A memory
 * without a photo never borrows OYNO artwork as if it were the user's.
 */
function MemoryCard({ entry, experience, index, language }: { entry: JournalEntry; experience: AgeExperience; index: number; language: SupportedLanguage }) {
  const { t } = useTranslation();
  const photo: ImageSourcePropType | null = entry.photo?.localUri ? { uri: entry.photo.localUri } : null;
  const title = entry.title || entry.link?.label || t('journal.untitled');
  const date = formatEntryDate(entry.date, language);
  const scrapbook = experience === 'preteen';
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const noteLines = isChild ? 0 : photo ? 2 : 4;

  return (
    <AnimatedPressable
      style={[styles.card, !photo && styles.cardText]}
      onPress={() => router.push(`/journal/${entry.id}` as never)}
      press="soft"
      accessibilityRole="button"
      accessibilityLabel={t('journal.entryA11y', { title, date })}
    >
      {photo ? (
        <View style={[styles.photoWrap, scrapbook && { transform: [{ rotate: index % 2 === 0 ? '-1.5deg' : '1.2deg' }] }]}>
          <MediaImage source={photo} fill={false} style={[styles.photo, isChild && styles.photoChild]} />
          {scrapbook ? <View style={styles.tape} /> : null}
        </View>
      ) : (
        <OymoOrnament size={14} color={colors.accentGoldPressed} strokeWidth={1.75} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardDate}>{date}</Text>
        <Text style={[styles.cardTitle, isAdult && styles.cardTitleEditorial, isChild && styles.cardTitleChild]} numberOfLines={2}>
          {title}
        </Text>
        {entry.note && noteLines > 0 ? (
          <Text style={styles.cardNote} numberOfLines={noteLines}>
            {entry.note}
          </Text>
        ) : null}
        {entry.link ? <LinkedPill link={entry.link} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  topRow: { flexDirection: 'row' },
  header: { gap: 3 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...textStyles.overline, color: colors.accentGoldPressed },
  title: { ...textStyles.h1, color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.h1) },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitle: { ...textStyles.caption, color: colors.textMuted, flexShrink: 1 },
  filtersBleed: { marginHorizontal: -spacing.md, flexGrow: 0 },
  filters: { gap: spacing.xs, paddingHorizontal: spacing.md },
  group: { gap: spacing.sm },
  month: { ...textStyles.overline, color: colors.textSecondary, marginTop: spacing.sm },
  monthAdult: { color: colors.accentGoldPressed, letterSpacing: 2 },
  card: { gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  cardText: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, backgroundColor: colors.surfaceWarm },
  photoWrap: {},
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.compact },
  photoChild: { aspectRatio: 1 },
  tape: { position: 'absolute', top: -6, left: '42%', width: 44, height: 14, backgroundColor: 'rgba(232,185,61,0.6)', transform: [{ rotate: '-4deg' }] },
  cardBody: { flex: 1, gap: 4, paddingHorizontal: 2, paddingBottom: 2 },
  cardDate: { ...textStyles.small, color: colors.textMuted },
  cardTitle: { ...textStyles.title, color: colors.textPrimary },
  cardTitleEditorial: { ...editorial(textStyles.title) },
  cardTitleChild: { ...textStyles.h3 },
  cardNote: { ...textStyles.body, color: colors.textSecondary },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, maxWidth: '100%', marginTop: 2, paddingLeft: 3, paddingRight: spacing.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.background },
  pillThumb: { width: 20, height: 20, borderRadius: 10 },
  pillText: { ...textStyles.small, color: colors.primary, flexShrink: 1 },
});
