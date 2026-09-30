import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, TextField } from '@/components/ui';
import { callAdminRpc } from '@/services/admin/adminService';
import type { TranslatedContentType } from '@/services/content/localizedContent';
import { colors, radii, spacing, typography } from '@/theme';

import { kyrgyzSourceOf, translatableFields, validateTranslation, type AdminTranslationRow } from '../adminModel';
import type { AdminRow } from '../sections';
import { ADMIN_TRANSLATIONS_KEY } from '../useAdminData';

type Draft = { value: string; status: 'draft' | 'reviewed' };
type Language = 'ru' | 'en';

const LANGUAGE_LABEL: Record<Language, string> = { ru: 'RU · Russian', en: 'EN · English' };

/**
 * RU / EN translations of one content row, field by field, next to the
 * Kyrgyz original. Each field saves on its own (admin_upsert_content_
 * translation) with a real saving / saved / failed state; only "reviewed"
 * translations are shown to readers. Reports unsaved edits upward so the
 * editor can warn before leaving.
 */
export function TranslationsPanel({
  contentType,
  contentId,
  row,
  translations,
  fieldLabel,
  onDirtyChange,
}: {
  contentType: TranslatedContentType;
  contentId: string;
  row: AdminRow;
  translations: readonly AdminTranslationRow[];
  fieldLabel: (field: string) => string;
  onDirtyChange: (dirtyCount: number) => void;
}) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<Language>('ru');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [states, setStates] = useState<Record<string, { kind: 'saving' | 'saved' | 'error'; message?: string }>>({});
  const fields = translatableFields(contentType, row);

  const existing = useMemo(() => {
    const map: Record<string, AdminTranslationRow> = {};
    for (const translation of translations) if (translation.content_type === contentType && translation.content_id === contentId) map[`${translation.language}|${translation.field}`] = translation;
    return map;
  }, [translations, contentType, contentId]);

  const valueOf = (key: string): Draft => drafts[key] ?? { value: existing[key]?.value ?? '', status: existing[key]?.status ?? 'draft' };
  const isChanged = (key: string) => {
    const draft = drafts[key];
    if (!draft) return false;
    return draft.value !== (existing[key]?.value ?? '') || draft.status !== (existing[key]?.status ?? 'draft');
  };
  const dirtyKeys = Object.keys(drafts).filter(isChanged);

  useEffect(() => {
    onDirtyChange(dirtyKeys.length);
  }, [dirtyKeys.length, onDirtyChange]);

  const save = useMutation({
    mutationFn: ({ key, draft }: { key: string; draft: Draft }) => {
      const [lang, field] = key.split('|');
      return callAdminRpc('admin_upsert_content_translation', {
        p_content_type: contentType,
        p_content_id: contentId,
        p_language: lang,
        p_field: field,
        p_value: draft.value.trim(),
        p_status: draft.status,
      });
    },
    onMutate: ({ key }) => setStates((current) => ({ ...current, [key]: { kind: 'saving' } })),
    onSuccess: async (_data, { key }) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_TRANSLATIONS_KEY });
      setDrafts(({ [key]: _saved, ...rest }) => rest);
      setStates((current) => ({ ...current, [key]: { kind: 'saved' } }));
    },
    onError: (error: Error, { key }) => setStates((current) => ({ ...current, [key]: { kind: 'error', message: error.message } })),
  });

  function saveOne(key: string) {
    const draft = valueOf(key);
    const problem = validateTranslation(draft.value, draft.status);
    if (problem) return setStates((current) => ({ ...current, [key]: { kind: 'error', message: problem } }));
    save.mutate({ key, draft });
  }

  if (fields.length === 0) return <Text style={styles.note}>Nothing to translate yet - fill in the Kyrgyz text first.</Text>;

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['ru', 'en'] as const).map((option) => (
          <AnimatedPressable
            key={option}
            style={[styles.tab, language === option && styles.tabActive]}
            onPress={() => setLanguage(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: language === option }}
            accessibilityLabel={LANGUAGE_LABEL[option]}
          >
            <Text style={[styles.tabText, language === option && styles.tabTextActive]}>{LANGUAGE_LABEL[option]}</Text>
          </AnimatedPressable>
        ))}
      </View>
      <Text style={styles.note}>Only "Reviewed" translations are shown to readers, and an article body appears in {language.toUpperCase()} only once every field below is reviewed.</Text>

      {fields.map((field) => {
        const key = `${language}|${field}`;
        const draft = valueOf(key);
        const state = states[key];
        const updated = existing[key]?.updated_at;
        return (
          <View key={key} style={styles.field}>
            <Text style={styles.fieldLabel}>{fieldLabel(field)}</Text>
            <View style={styles.source}>
              <Text style={styles.sourceTag}>KG</Text>
              <Text style={styles.sourceText} numberOfLines={4} selectable>
                {kyrgyzSourceOf(row, field)}
              </Text>
            </View>
            <TextField
              label={`${language.toUpperCase()} · ${fieldLabel(field)}`}
              value={draft.value}
              onChangeText={(value) => setDrafts((current) => ({ ...current, [key]: { ...draft, value } }))}
              multiline
              numberOfLines={field === 'title' || field === 'alt_names' ? 1 : 4}
            />
            <View style={styles.fieldFooter}>
              {(['draft', 'reviewed'] as const).map((status) => (
                <AnimatedPressable
                  key={status}
                  style={[styles.pill, draft.status === status && styles.pillActive]}
                  onPress={() => setDrafts((current) => ({ ...current, [key]: { ...draft, status } }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.status === status }}
                  accessibilityLabel={status === 'draft' ? 'Draft' : 'Reviewed'}
                >
                  <Text style={[styles.pillText, draft.status === status && styles.pillTextActive]}>{status === 'draft' ? 'Draft' : 'Reviewed'}</Text>
                </AnimatedPressable>
              ))}
              <View style={styles.spacer} />
              <Button label="Save" size="sm" onPress={() => saveOne(key)} disabled={!isChanged(key) || state?.kind === 'saving'} loading={state?.kind === 'saving'} />
            </View>
            <Text style={[styles.state, state?.kind === 'error' && styles.stateError]} accessibilityLiveRegion="polite">
              {state?.kind === 'error' ? state.message : state?.kind === 'saved' ? 'Saved.' : isChanged(key) ? 'Unsaved changes' : updated ? `Last saved ${new Date(updated).toLocaleDateString()}` : existing[key] ? '' : 'Not translated yet'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  tabTextActive: { color: colors.textOnPrimary },
  note: { ...typography.small, color: colors.textMuted },
  field: { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  fieldLabel: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  source: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  sourceTag: { ...typography.small, fontWeight: '800', color: colors.accentTerracotta },
  sourceText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  fieldFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.surfaceBorder },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.small, color: colors.textPrimary },
  pillTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  spacer: { flex: 1 },
  state: { ...typography.small, color: colors.textMuted },
  stateError: { color: colors.danger },
});
