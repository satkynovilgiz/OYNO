import { router } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, Chip, IconButton } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useShareCard } from '@/services/share/useShareCard';
import { useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { formatEntryDate } from '../journalDisplay';
import { CAPTION_MAX, canCreate, cleanCaption, collageItems, collagePresentation, eligibleMemories, MIN_SELECTED, toggleSelection, type CollageLayout } from './collageModel';
import { COLLAGE_FRAME, CollageView } from './CollageView';

/**
 * /journal/collage - pick 2-6 of your own memories, a layout and an
 * optional title, preview, then share/save only if you choose to. Nothing
 * is uploaded or stored, and no Journal entry is changed. Notes stay off
 * unless "Include short notes" is turned on.
 */
export function JournalCollageScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { experience } = useAgeExperience();
  const presentation = collagePresentation(experience);
  const entries = useJournalStore((state) => state.entries);
  const { share, shareHost } = useShareCard();
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<CollageLayout>(presentation.defaultLayout);
  const [caption, setCaption] = useState('');
  const [includeNotes, setIncludeNotes] = useState(false);

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  const memories = useMemo(() => eligibleMemories(entries), [entries]);
  // A memory deleted meanwhile simply drops out of the selection.
  const validSelected = selected.filter((id) => memories.some((entry) => entry.id === id));
  const items = collageItems(entries, validSelected, { includeNotes });
  const ready = canCreate(validSelected, presentation.maxSelected);
  const previewWidth = Math.min(width - spacing.lg * 2, 360);
  const formatDate = (date: string) => formatEntryDate(date, language);

  const onShare = () => {
    track('journal_collage_created', { selected_count: items.length });
    const clean = cleanCaption(caption);
    void share(
      {
        title: clean || t('journalCollage.defaultTitle'),
        label: t('journalCollage.label'),
        imageSource: null,
        variant: 'creation',
        artworkSize: COLLAGE_FRAME,
        artwork: <CollageView items={items} layout={layout} caption="" width={COLLAGE_FRAME.width} formatDate={formatDate} unavailableLabel={t('journalCollage.photoUnavailable')} editorial={presentation.editorial} />,
      },
      clean || t('journalCollage.defaultTitle'),
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('journalCollage.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.meta}>{t('journalCollage.privateNote')}</Text>

        <Text style={styles.section} accessibilityRole="header">
          {t('journalCollage.choose', { min: MIN_SELECTED, max: presentation.maxSelected })}
        </Text>
        {memories.length < MIN_SELECTED ? <Text style={styles.meta}>{t('journalCollage.notEnough')}</Text> : null}
        {memories.map((entry) => {
          const on = validSelected.includes(entry.id);
          const full = !on && validSelected.length >= presentation.maxSelected;
          return (
            <AnimatedPressable
              key={entry.id}
              style={[styles.row, on && styles.rowOn]}
              disabled={full}
              onPress={() => setSelected((current) => toggleSelection(current.filter((id) => memories.some((m) => m.id === id)), entry.id, presentation.maxSelected))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: full }}
              aria-checked={on}
              accessibilityLabel={`${entry.title}. ${formatDate(entry.date)}${entry.photo ? `. ${t('journalCollage.hasPhoto')}` : ''}`}
            >
              {entry.photo?.localUri ? <Image source={{ uri: entry.photo.localUri }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPaper]} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text style={styles.meta}>{formatDate(entry.date)}</Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={colors.textOnPrimary} strokeWidth={3} /> : null}</View>
            </AnimatedPressable>
          );
        })}

        {presentation.layouts.length > 1 ? (
          <>
            <Text style={styles.section} accessibilityRole="header">
              {t('journalCollage.layout')}
            </Text>
            <View style={styles.chips}>
              {presentation.layouts.map((option) => (
                <Chip key={option} label={t(`journalCollage.layouts.${option}`)} selected={layout === option} onPress={() => setLayout(option)} />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>{t('journalCollage.caption')}</Text>
        <TextInput
          value={caption}
          onChangeText={(value) => setCaption(value.slice(0, CAPTION_MAX))}
          maxLength={CAPTION_MAX}
          placeholder={t('journalCollage.captionPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('journalCollage.caption')}
        />
        <Text style={styles.counter}>
          {caption.length} / {CAPTION_MAX}
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle}>{t('journalCollage.includeNotes')}</Text>
            <Text style={styles.meta}>{t('journalCollage.includeNotesHint')}</Text>
          </View>
          <Switch value={includeNotes} onValueChange={setIncludeNotes} accessibilityLabel={t('journalCollage.includeNotes')} />
        </View>

        {ready ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.section}>{t('journalCollage.preview')}</Text>
            <CollageView items={items} layout={layout} caption={cleanCaption(caption)} width={previewWidth} formatDate={formatDate} unavailableLabel={t('journalCollage.photoUnavailable')} editorial={presentation.editorial} />
            <Button label={t('journalCollage.share')} size={experience === 'child' ? 'lg' : 'md'} block onPress={onShare} />
          </View>
        ) : (
          <Text style={styles.meta}>{t('journalCollage.pickMore', { min: MIN_SELECTED })}</Text>
        )}
        <Button label={t('journalCollage.backToJournal')} variant="text" onPress={() => (router.canGoBack() ? router.back() : router.replace('/journal' as never))} />
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  section: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
  meta: { ...textStyles.small, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowOn: { borderColor: colors.primary },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  thumbPaper: { backgroundColor: colors.surfaceAlt },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  counter: { ...textStyles.small, color: colors.textMuted, alignSelf: 'flex-end' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
});
