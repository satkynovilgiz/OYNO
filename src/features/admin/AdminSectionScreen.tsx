import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton, TextField } from '@/components/ui';
import { callAdminRpc } from '@/services/admin/adminService';
import { pickAndUploadCultureItemImage, pickAndUploadCultureMaterialImage } from '@/services/admin/mediaUpload';
import { colors, radii, spacing, typography } from '@/theme';

import { coverageFor, EMPTY_FILTER, filterAdminRows, isDirty, validateAdminValues, valuesToRow, verificationOf, type AdminFilter, type Coverage } from './adminModel';
import { ContentPreviewPanel } from './components/ContentPreviewPanel';
import { ReviewNotePanel } from './components/ReviewNotePanel';
import { SourcesEditor } from './components/SourcesEditor';
import { CoverageBadges, VerificationBadge } from './components/StatusBadges';
import { TranslationsPanel } from './components/TranslationsPanel';
import { rowToFormValues, type AdminFieldConfig, type AdminRow, type AdminSectionConfig } from './sections';
import { useAdminCatalog, useAdminReviewNotes, useAdminTranslations } from './useAdminData';
import { changedTranslationKeys, liveTranslationsFor, mergeTranslations, REVISION_SECTIONS, withDraftTranslations, type TranslationEdits } from './revisions/revisionModel';
import { RevisionScaffold } from './revisions/RevisionWorkflow';

const IMAGE_UPLOAD_SECTIONS = {
  culture_items: pickAndUploadCultureItemImage,
  culture_materials: pickAndUploadCultureMaterialImage,
} as const;

/** Content types a review note can be attached to (content_review_notes). */
const REVIEW_NOTE_TYPES: Record<string, string> = {
  culture_items: 'culture_item',
  culture_materials: 'culture_material',
  explore_regions: 'explore_region',
  discoveries: 'discovery',
};

type AdminSectionScreenProps = {
  section: AdminSectionConfig;
  onPressBack: () => void;
};

type SaveState = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

function FieldInput({ field, value, onChange }: { field: AdminFieldConfig; value: string; onChange: (v: string) => void }) {
  if (field.kind === 'sources') return <SourcesEditor label={field.label} value={value} onChange={onChange} />;
  if (field.type === 'select') {
    return (
      <View style={styles.selectWrap}>
        <Text style={styles.selectLabel}>{field.label}</Text>
        <View style={styles.selectOptions} accessibilityRole="radiogroup" accessibilityLabel={field.label}>
          {field.options?.map((option) => (
            <AnimatedPressable
              key={option || '(empty)'}
              style={[styles.optionPill, value === option && styles.optionPillActive]}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === option }}
              accessibilityLabel={option || '(empty)'}
            >
              <Text style={[styles.optionLabel, value === option && styles.optionLabelActive]}>{option || '(empty)'}</Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <TextField
      label={field.required ? `${field.label} *` : field.label}
      value={value}
      onChangeText={onChange}
      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
      multiline={field.type === 'textarea' || field.type === 'array'}
      numberOfLines={field.type === 'array' ? 4 : 6}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorSectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Generic list + editor for one admin section (features/admin/sections.ts):
 * compact searchable list with verification and KG/RU/EN coverage, and an
 * editor with sources, translations, review note and a per-language
 * preview. Every write still goes through the section's admin_* RPC, which
 * the server authorizes; unsaved edits are never discarded silently. */
export function AdminSectionScreen({ section, onPressBack }: AdminSectionScreenProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [editingRow, setEditingRow] = useState<AdminRow | 'new' | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AdminFilter>(EMPTY_FILTER);
  const [translationDirty, setTranslationDirty] = useState(0);
  // Revision-managed content: unpublished RU/EN edits (never written live from here).
  const [translationEdits, setTranslationEdits] = useState<TranslationEdits>({});
  const [noteDirty, setNoteDirty] = useState(false);

  const { data: rows, isLoading, error } = useQuery({ queryKey: ['admin_section', section.id], queryFn: section.fetch });
  const { data: translations } = useAdminTranslations(!!section.contentType);
  const reviewNoteType = REVIEW_NOTE_TYPES[section.id];
  const { data: reviewNotes } = useAdminReviewNotes(!!reviewNoteType);
  const linkTables = useMemo(() => [...new Set((section.links?.({}) ?? []).map((link) => link.table).concat(section.id === 'quest_steps' ? ['explore_regions', 'discoveries', 'culture_items', 'quiz_questions'] : []))], [section]);
  const catalog = useAdminCatalog(linkTables);

  const coverageOf = useCallback((row: AdminRow) => (section.contentType ? coverageFor(section.contentType, row, translations ?? []) : null), [section.contentType, translations]);

  const revisionType = REVISION_SECTIONS[section.id];
  const editingId = editingRow && editingRow !== 'new' ? String(editingRow[section.idField] ?? '') : '';
  const liveTranslations = useMemo(() => (revisionType && editingId ? liveTranslationsFor(revisionType, editingId, translations ?? []) : []), [revisionType, editingId, translations]);
  const revisionTranslationDirty = revisionType ? changedTranslationKeys(liveTranslations, translationEdits).length : 0;
  const dirty = !!editingRow && (isDirty(initialValues, formValues) || translationDirty > 0 || revisionTranslationDirty > 0 || noteDirty);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Leaving the section (back gesture, Android back, header back) with
  // unsaved edits asks first instead of discarding them.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirtyRef.current) return;
        event.preventDefault();
        setPendingLeave(() => () => navigation.dispatch(event.data.action));
      }),
    [navigation],
  );

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) => callAdminRpc(section.upsertRpc, section.toParams(values)),
    onSuccess: async (_data, values) => {
      await queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      // Stay in the editor on the saved values (translations can follow).
      setInitialValues(values);
      if (editingRow === 'new') setEditingRow({ ...valuesToRow(section, values) });
      setSaveState({ kind: 'saved' });
    },
    onError: (err: Error) => setSaveState({ kind: 'error', message: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => callAdminRpc(section.deleteRpc, { p_id: id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      setPendingDeleteId(null);
    },
  });

  function openEditor(row: AdminRow | null) {
    const values = rowToFormValues(section, row);
    setEditingRow(row ?? 'new');
    setInitialValues(values);
    setFormValues(values);
    setSaveState({ kind: 'idle' });
    setImageUrl((row?.image_url as string | null | undefined) ?? null);
    setImageError(null);
    setTranslationDirty(0);
    setTranslationEdits({});
    setNoteDirty(false);
  }

  function closeEditor() {
    const close = () => {
      setEditingRow(null);
      setTranslationDirty(0);
      setTranslationEdits({});
      setNoteDirty(false);
    };
    if (dirty) setPendingLeave(() => close);
    else close();
  }

  function handleSave() {
    if (saveMutation.isPending) return;
    const problem = validateAdminValues(section, formValues, catalog);
    if (problem) return setSaveState({ kind: 'error', message: problem });
    setSaveState({ kind: 'idle' });
    saveMutation.mutate(formValues);
  }

  async function handleUploadImage() {
    if (editingRow === 'new' || !editingRow) return;
    const uploader = IMAGE_UPLOAD_SECTIONS[section.id as keyof typeof IMAGE_UPLOAD_SECTIONS];
    if (!uploader) return;
    setIsUploadingImage(true);
    setImageError(null);
    try {
      const url = await uploader(String(editingRow[section.idField]));
      if (url) {
        setImageUrl(url);
        void queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      }
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setIsUploadingImage(false);
    }
  }

  const fieldLabel = useCallback(
    (key: string) => {
      const fact = /^fact\.(\d+)$/.exec(key);
      if (fact) return `Fact ${Number(fact[1]) + 1}`;
      return section.fields.find((field) => field.key === key)?.label ?? key;
    },
    [section.fields],
  );

  const leaveModal = (
    <ConfirmationModal
      visible={!!pendingLeave}
      title="Discard unsaved changes?"
      message="Your edits on this screen haven't been saved yet."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        const leave = pendingLeave;
        setPendingLeave(null);
        dirtyRef.current = false;
        setTranslationDirty(0);
        setTranslationEdits({});
        setNoteDirty(false);
        leave?.();
      }}
      onCancel={() => setPendingLeave(null)}
    />
  );

  if (editingRow) {
    const isNew = editingRow === 'new';
    const contentId = isNew ? '' : String(editingRow[section.idField] ?? '');
    const currentRow = valuesToRow(section, formValues);
    const canSave = (isDirty(initialValues, formValues) || isNew) && !saveMutation.isPending;
    // Revision editors preview their draft translations, not the live ones.
    const previewTranslations = revisionType ? withDraftTranslations(revisionType, contentId, translations ?? [], mergeTranslations(liveTranslations, translationEdits)) : (translations ?? []);
    const editorSections = (
      <>
        {section.id in IMAGE_UPLOAD_SECTIONS && !isNew ? (
          <Section title="Photo">
            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" accessibilityLabel="Current photo" /> : <Text style={styles.muted}>No uploaded photo - the app shows the bundled photo for this id, if any.</Text>}
            {imageError ? <Text style={styles.error}>{imageError}</Text> : null}
            <Button label={imageUrl ? 'Replace photo' : 'Upload photo'} variant="secondary" onPress={handleUploadImage} loading={isUploadingImage} />
          </Section>
        ) : null}

        <Section title={section.contentType ? 'Kyrgyz content (canonical)' : 'Fields'}>
          {section.fields.map((field) => (
            <FieldInput key={field.key} field={field} value={formValues[field.key] ?? ''} onChange={(v) => setFormValues((prev) => ({ ...prev, [field.key]: v }))} />
          ))}
        </Section>

        {section.contentType && !isNew ? (
          <Section title="Translations (RU / EN)">
            <TranslationsPanel
              contentType={section.contentType}
              contentId={contentId}
              row={currentRow}
              translations={translations ?? []}
              fieldLabel={fieldLabel}
              mode={revisionType ? { kind: 'revision_draft', live: liveTranslations, edits: translationEdits, onEditsChange: setTranslationEdits } : { kind: 'direct', onDirtyChange: setTranslationDirty }}
            />
          </Section>
        ) : null}

        {reviewNoteType && !isNew ? (
          <Section title="Verification review">
            <ReviewNotePanel contentType={reviewNoteType} contentId={contentId} notes={reviewNotes ?? []} onDirtyChange={setNoteDirty} />
          </Section>
        ) : null}

        {section.contentType ? (
          <Section title="Preview (as readers see it)">
            <ContentPreviewPanel contentType={section.contentType} row={{ ...currentRow, id: contentId }} translations={previewTranslations} fieldLabel={fieldLabel} />
          </Section>
        ) : null}
      </>
    );
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back to list" onPress={closeEditor} />
          <Text style={styles.title} numberOfLines={1}>
            {isNew ? `New · ${section.label}` : String(formValues[section.titleField] || contentId)}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {revisionType ? (
          <RevisionScaffold
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 160 }]}
            section={section}
            type={revisionType}
            contentId={contentId}
            isNew={isNew}
            values={formValues}
            liveValues={initialValues}
            translations={translations ?? []}
            translationEdits={translationEdits}
            onTranslationEditsChange={setTranslationEdits}
            fieldLabel={fieldLabel}
            onPublished={(values) => {
              setInitialValues(values);
              if (isNew) setEditingRow({ ...valuesToRow(section, values) });
            }}
            onReplaceValues={(values, asLive) => {
              setFormValues(values);
              if (asLive) setInitialValues(values);
            }}
          >
            {editorSections}
          </RevisionScaffold>
        ) : (
          <>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]} keyboardShouldPersistTaps="handled">
              {editorSections}
            </ScrollView>
            {/* Save bar stays reachable above the keyboard. */}
            <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.sm }]}>
              <Text style={[styles.saveState, saveState.kind === 'error' && styles.error]} numberOfLines={3} accessibilityLiveRegion="polite">
                {saveMutation.isPending ? 'Saving…' : saveState.kind === 'saved' && !isDirty(initialValues, formValues) ? 'Saved.' : saveState.kind === 'error' ? saveState.message : isDirty(initialValues, formValues) ? 'Unsaved changes' : ''}
              </Text>
              <Button label={isNew ? 'Create' : 'Save'} onPress={handleSave} loading={saveMutation.isPending} disabled={!canSave} />
            </View>
          </>
        )}
        {leaveModal}
      </KeyboardAvoidingView>
    );
  }

  const allRows = rows ?? [];
  const visibleRows = filterAdminRows(section, allRows, filter, coverageOf);
  const localizationChips: { label: string; value: { language: 'ru' | 'en'; coverage: Coverage } }[] = [
    { label: 'RU missing', value: { language: 'ru', coverage: 'missing' } },
    { label: 'RU partial', value: { language: 'ru', coverage: 'partial' } },
    { label: 'EN missing', value: { language: 'en', coverage: 'missing' } },
    { label: 'EN partial', value: { language: 'en', coverage: 'partial' } },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title} numberOfLines={1}>
          {section.label}
        </Text>
        <IconButton icon={Plus} shape="roundedSquare" accessibilityLabel="New" onPress={() => openEditor(null)} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{(error as Error).message}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <TextField label="Search by title or id" value={filter.query} onChangeText={(query) => setFilter((current) => ({ ...current, query }))} autoCapitalize="none" />
          {section.verificationField ? (
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Verification filter">
              {(['all', 'verified', 'partially_verified', 'unverified'] as const).map((level) => (
                <FilterChip key={level} label={level === 'all' ? 'All' : level === 'partially_verified' ? 'Partial' : level === 'verified' ? 'Verified' : 'Unverified'} selected={filter.verification === level} onPress={() => setFilter((current) => ({ ...current, verification: level }))} />
              ))}
            </View>
          ) : null}
          {section.contentType ? (
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Translation filter">
              <FilterChip label="Any language" selected={!filter.localization} onPress={() => setFilter((current) => ({ ...current, localization: null }))} />
              {localizationChips.map((chip) => (
                <FilterChip
                  key={chip.label}
                  label={chip.label}
                  selected={filter.localization?.language === chip.value.language && filter.localization.coverage === chip.value.coverage}
                  onPress={() => setFilter((current) => ({ ...current, localization: chip.value }))}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            {visibleRows.length === allRows.length ? `${allRows.length} rows` : `${visibleRows.length} of ${allRows.length} rows`}
          </Text>

          {visibleRows.map((row) => {
            const id = String(row[section.idField]);
            const verification = verificationOf(section, row);
            const coverage = coverageOf(row);
            return (
              <View key={id} style={styles.row}>
                <AnimatedPressable style={styles.rowMain} onPress={() => openEditor(row)} accessibilityRole="button" accessibilityLabel={`Edit ${String(row[section.titleField] ?? id)}`}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {String(row[section.titleField] ?? id)}
                  </Text>
                  <Text style={styles.rowId} numberOfLines={1}>
                    {id}
                  </Text>
                  {verification || coverage ? (
                    <View style={styles.badges}>
                      {verification ? <VerificationBadge level={verification} /> : null}
                      {coverage ? <CoverageBadges coverage={coverage} /> : null}
                    </View>
                  ) : null}
                </AnimatedPressable>
                <IconButton icon={Trash2} size={40} iconSize={16} shape="roundedSquare" elevated={false} accessibilityLabel={`Delete ${id}`} onPress={() => setPendingDeleteId(id)} />
              </View>
            );
          })}
          {allRows.length === 0 ? <Text style={styles.empty}>No rows yet - tap + to create one.</Text> : visibleRows.length === 0 ? <Text style={styles.empty}>Nothing matches these filters.</Text> : null}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={!!pendingDeleteId}
        title="Delete this row?"
        message="This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
      {leaveModal}
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable style={[styles.optionPill, selected && styles.optionPillActive]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label}>
      <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  title: { ...typography.bodyBold, fontSize: 17, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radii.lg, paddingVertical: spacing.xs, paddingLeft: spacing.sm, paddingRight: spacing.xxs, borderWidth: 1, borderColor: colors.surfaceBorder },
  rowMain: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowId: { ...typography.small, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  muted: { ...typography.small, color: colors.textMuted },
  error: { ...typography.small, color: colors.danger },
  editorSection: { gap: spacing.sm, paddingTop: spacing.sm },
  editorSectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  imagePreview: { width: '100%', height: 160, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  selectWrap: { gap: spacing.xxs },
  selectLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  selectOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  optionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLabel: { ...typography.caption, color: colors.textPrimary },
  optionLabelActive: { color: colors.textOnPrimary, fontWeight: '700' },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  saveState: { ...typography.small, color: colors.textSecondary, flex: 1 },
});
