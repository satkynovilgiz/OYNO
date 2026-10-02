import { router } from 'expo-router';
import { ChevronLeft, Search as SearchIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import type { CultureItemRow } from '@/services/content/types';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { searchHighlights, sortedHighlights, sourceUpdated, type ContentHighlight } from './highlightsModel';
import { NoteSheet } from './NoteSheet';
import { useHighlightActions, useHighlights } from './useHighlights';

const SECTION_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  when_used: 'culture.item.whenUsedLabel',
  ingredients: 'culture.item.ingredientsLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  who_participates: 'culture.item.whoParticipatesLabel',
  objects_used: 'culture.item.objectsUsedLabel',
  regional_notes: 'culture.item.regionalNotesLabel',
  modern_status: 'culture.item.modernStatusLabel',
  fun_facts: 'culture.item.funFactsLabel',
  body: 'highlights.section.body',
};
const LANGUAGE_NAME: Record<string, string> = { kg: 'Кыргызча', ru: 'Русский', en: 'English' };

/**
 * /profile/highlights - Highlights & Notes: private saved passages from
 * Culture articles with the user's own notes. Local search only; nothing
 * here is indexed globally or sent anywhere. Not the Journal.
 */
export function HighlightsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isAdult = experience === 'adult';
  const { data, owner } = useHighlights();
  const actions = useHighlightActions(owner);
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  const { share, shareHost } = useShareCard();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ContentHighlight | null>(null);
  const [removing, setRemoving] = useState<ContentHighlight | null>(null);

  const all = sortedHighlights(data);
  const shown = searchHighlights(all, query);
  const dateFormat = (iso: string) => {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  };

  // Live source lookup (for Open source + a reliable "Source updated").
  const liveSource = (highlight: ContentHighlight): { route: string; text: string | null; language: string } | null => {
    if (highlight.contentType === 'culture_item') {
      if (!items) return null;
      const item = items.find((row) => row.id === highlight.contentId);
      if (!item) return null;
      const value = item[highlight.sectionKey as keyof CultureItemRow];
      return { route: `/culture/item/${item.id}?section=${highlight.sectionKey}`, text: typeof value === 'string' ? value : null, language: item.translation?.status === 'available' ? i18n.language : 'kg' };
    }
    if (!materials) return null;
    const material = materials.find((row) => row.id === highlight.contentId);
    if (!material) return null;
    return { route: `/culture/material/${material.id}`, text: material.body ?? null, language: i18n.language !== 'kg' && material.translation?.status === 'available' ? i18n.language : 'kg' };
  };
  const sourcesLoaded = !!items && !!materials;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('highlights.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('highlights.intro')}</Text>
        {all.length > 0 ? (
          <View style={styles.field}>
            <SearchIcon size={16} color={colors.textSecondary} strokeWidth={2.25} />
            <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t('highlights.search')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('highlights.search')} />
          </View>
        ) : null}
        {all.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('highlights.empty')}</Text>
            <Text style={styles.emptyBody}>{t('highlights.emptyBody')}</Text>
            <Button label={t('highlights.browse')} variant="secondary" onPress={() => router.push('/culture' as never)} />
          </View>
        ) : null}
        {shown.map((highlight) => {
          const live = liveSource(highlight);
          const unavailable = sourcesLoaded && !live;
          const updated = sourceUpdated(highlight, live);
          const sectionLabel = t(SECTION_LABEL[highlight.sectionKey] ?? 'highlights.section.body');
          return (
            <View key={highlight.id} style={[styles.card, isAdult && styles.cardEditorial]}>
              <Text style={styles.source}>
                {highlight.titleSnapshot} · {sectionLabel}
              </Text>
              <Text style={styles.excerpt} numberOfLines={6}>
                {highlight.excerptSnapshot}
              </Text>
              {highlight.note ? (
                <View style={styles.note}>
                  <Text style={styles.noteLabel}>{t('highlights.yourNote')}</Text>
                  <Text style={styles.noteText}>{highlight.note}</Text>
                </View>
              ) : null}
              <Text style={styles.meta}>
                {dateFormat(highlight.createdAt)}
                {highlight.language !== i18n.language ? ` · ${t('highlights.savedIn', { language: LANGUAGE_NAME[highlight.language] ?? highlight.language })}` : ''}
                {updated ? ` · ${t('highlights.sourceUpdated')}` : ''}
                {unavailable ? ` · ${t('highlights.sourceUnavailable')}` : ''}
              </Text>
              <View style={styles.actions}>
                {live ? <Action label={t('highlights.openSource')} onPress={() => router.push(live.route as never)} /> : null}
                <Action label={highlight.note ? t('highlights.editNote') : t('highlights.addNote')} onPress={() => setEditing(highlight)} />
                <Action
                  label={t('highlights.sharePassage')}
                  onPress={() =>
                    // The authored passage + source title only - never the note.
                    void share({ title: highlight.titleSnapshot, label: sectionLabel, subtitle: highlight.excerptSnapshot.slice(0, 180), imageSource: null, fallbackTone: colors.surfaceFeature }, `${highlight.titleSnapshot}: ${highlight.excerptSnapshot.slice(0, 280)}`)
                  }
                />
                <Action label={t('highlights.removeHighlight')} danger onPress={() => setRemoving(highlight)} />
              </View>
            </View>
          );
        })}
        {all.length > 0 && shown.length === 0 ? <Text style={styles.emptyBody}>{t('highlights.noMatches')}</Text> : null}
        <Text style={styles.footnote}>{t('highlights.deviceNote')}</Text>
      </ScrollView>

      {editing ? (
        <NoteSheet
          initial={editing.note}
          onClose={() => setEditing(null)}
          onSave={(note) => {
            actions.setNote(editing.id, note);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmationModal
        visible={!!removing}
        title={t('highlights.removeTitle')}
        message={t('highlights.removeBody')}
        confirmLabel={t('highlights.removeHighlight')}
        cancelLabel={t('highlights.cancel')}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) actions.remove(removing.id);
          setRemoving(null);
        }}
      />
      {shareHost}
    </View>
  );
}

function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <AnimatedPressable style={styles.action} onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  intro: { ...textStyles.small, color: colors.textSecondary },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  input: { flex: 1, ...textStyles.body, color: colors.textPrimary },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  emptyBody: { ...textStyles.small, color: colors.textSecondary, textAlign: 'center' },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  cardEditorial: { borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  source: { ...typography.overline, color: colors.accentTerracotta },
  excerpt: { ...textStyles.body, color: colors.textPrimary },
  note: { gap: 2, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  noteLabel: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  noteText: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: { minHeight: 36, justifyContent: 'center' },
  actionText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  danger: { color: colors.error },
  footnote: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.sm },
});
