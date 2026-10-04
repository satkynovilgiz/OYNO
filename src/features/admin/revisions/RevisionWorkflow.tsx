import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { valuesToRow, type AdminTranslationRow } from '../adminModel';
import { ContentPreviewPanel } from '../components/ContentPreviewPanel';
import { VerificationBadge } from '../components/StatusBadges';
import type { AdminSectionConfig } from '../sections';
import { ADMIN_TRANSLATIONS_KEY } from '../useAdminData';
import {
  currentRevision,
  describeChangedFields,
  diffFields,
  diffTranslations,
  editorLabel,
  editsFromTranslations,
  fieldsFromValues,
  isConflict,
  liveTranslationsFor,
  mergeTranslations,
  publishProblem,
  publishScope,
  revisionErrorMessage,
  translationsProblem,
  valuesFromFields,
  withDraftTranslations,
  type RevisionContentType,
  type TranslationEdits,
} from './revisionModel';
import { discardDraft, getDraft, getRevision, listRevisions, publishContent, restoreRevision, saveDraft } from './revisionService';

type Message = { tone: 'info' | 'error'; text: string } | null;

/** A draft rejected locally before any request (shown verbatim). */
class DraftProblem extends Error {}

const SCOPE_STATUS = {
  none: 'Matches the live version',
  content: 'Unpublished changes: Kyrgyz content',
  translations: 'Unpublished changes: translations',
  both: 'Unpublished changes: Kyrgyz content + translations',
} as const;

/**
 * (Hook: returns the in-editor panel and the bottom bar.) Draft -> Preview -> Publish, plus Revision history and safe rollback, for
 * Culture items/materials inside the existing section editor. The live row
 * AND its RU/EN translations change ONLY through admin_publish_content /
 * admin_restore_revision (one transaction each); a failed call leaves the
 * editor's text on screen and never claims success. Translation edits live
 * in `translationEdits` (editor state) until then.
 */
export function useRevisionWorkflow({
  section,
  type,
  contentId,
  isNew,
  values,
  liveValues,
  translations,
  translationEdits,
  onTranslationEditsChange,
  fieldLabel,
  onPublished,
  onReplaceValues,
}: {
  section: AdminSectionConfig;
  type: RevisionContentType;
  contentId: string;
  isNew: boolean;
  values: Record<string, string>;
  liveValues: Record<string, string>;
  /** Live admin translation rows (all content). */
  translations: readonly AdminTranslationRow[];
  /** Unpublished RU/EN edits for this content (see TranslationsPanel revision_draft mode). */
  translationEdits: TranslationEdits;
  onTranslationEditsChange: (edits: TranslationEdits) => void;
  fieldLabel: (field: string) => string;
  onPublished: (values: Record<string, string>) => void;
  /** Replace the editor content (latest live version, a draft, or a restored revision). */
  onReplaceValues: (values: Record<string, string>, asLive: boolean) => void;
}): { panel: ReactNode; bar: ReactNode } {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const enabled = !isNew && !!contentId;
  const revisions = useQuery({ queryKey: ['admin_revisions', type, contentId], queryFn: () => listRevisions(type, contentId), enabled });
  const draft = useQuery({ queryKey: ['admin_draft', type, contentId], queryFn: () => getDraft(type, contentId), enabled });
  // The revision this editor was opened on - publishing checks it server-side.
  const [expected, setExpected] = useState<number | null>(isNew ? 0 : null);
  useEffect(() => {
    if (expected === null && revisions.data) setExpected(currentRevision(revisions.data));
  }, [expected, revisions.data]);
  const [message, setMessage] = useState<Message>(null);
  const [conflict, setConflict] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [draftHandled, setDraftHandled] = useState(false);

  const id = isNew ? (values[section.idField] ?? '').trim() : contentId;
  const fields = fieldsFromValues(section, values);
  const live = isNew ? null : fieldsFromValues(section, liveValues);
  const fieldChanges = diffFields(live, fields, fieldLabel);
  const liveTranslations = liveTranslationsFor(type, id, translations);
  const draftTranslations = mergeTranslations(liveTranslations, translationEdits);
  const translationChanges = isNew ? [] : diffTranslations(liveTranslations, draftTranslations, fieldLabel);
  const scope = publishScope(fieldChanges, translationChanges);
  const changes = [...fieldChanges, ...translationChanges];
  const problem = publishProblem(fields) ?? translationsProblem(type, draftTranslations, fieldLabel, true);
  const previewTranslations = withDraftTranslations(type, id, translations, draftTranslations);
  const revisionsMissing = !!revisions.error && /could not find the function|PGRST202/i.test(String((revisions.error as { message?: string; code?: string }).message ?? (revisions.error as { code?: string }).code));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] }),
      queryClient.invalidateQueries({ queryKey: ['admin_revisions', type, id] }),
      queryClient.invalidateQueries({ queryKey: ['admin_draft', type, id] }),
      queryClient.invalidateQueries({ queryKey: ADMIN_TRANSLATIONS_KEY }),
    ]);
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const draftProblem = translationsProblem(type, draftTranslations, fieldLabel, false);
      if (draftProblem) throw new DraftProblem(draftProblem);
      await saveDraft(type, id, fields, draftTranslations, expected ?? 0);
    },
    onSuccess: async () => {
      setMessage({ tone: 'info', text: 'Draft saved. It is not public - readers still see the live version.' });
      await queryClient.invalidateQueries({ queryKey: ['admin_draft', type, id] });
    },
    onError: (error: Error) => setMessage({ tone: 'error', text: error instanceof DraftProblem ? error.message : revisionErrorMessage(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishContent(type, id, fields, draftTranslations, expected ?? -1),
    onSuccess: async (revision) => {
      setExpected(revision);
      onTranslationEditsChange({});
      setConflict(false);
      setPreviewOpen(false);
      setMessage({ tone: 'info', text: `Published as revision ${revision}.` });
      onPublished(values);
      await invalidate();
    },
    onError: (error: Error) => {
      setConflict(isConflict(error));
      setMessage({ tone: 'error', text: revisionErrorMessage(error) });
    },
  });

  const viewed = useQuery({ queryKey: ['admin_revision', type, id, viewing], queryFn: () => getRevision(type, id, viewing!), enabled: viewing !== null });

  const restoreMutation = useMutation({
    mutationFn: (revision: number) => restoreRevision(type, id, revision, expected ?? -1),
    onSuccess: async (revision) => {
      const snapshot = viewed.data;
      setExpected(revision);
      setConfirmRestore(false);
      setViewing(null);
      setConflict(false);
      if (snapshot) onReplaceValues(valuesFromFields(section, snapshot.fields, id), true);
      onTranslationEditsChange({});
      setMessage({ tone: 'info', text: `Restored as new revision ${revision}.` });
      await invalidate();
    },
    onError: (error: Error) => {
      setConfirmRestore(false);
      setConflict(isConflict(error));
      setMessage({ tone: 'error', text: revisionErrorMessage(error) });
    },
  });

  const refreshLatest = async () => {
    setConfirmRefresh(false);
    const [rows, list] = await Promise.all([section.fetch(), listRevisions(type, id)]);
    const row = rows.find((candidate) => String(candidate[section.idField]) === id);
    queryClient.setQueryData(['admin_section', section.id], rows);
    queryClient.setQueryData(['admin_revisions', type, id], list);
    if (row) {
      const latest = valuesFromFields(section, row, id);
      onReplaceValues(latest, true);
    }
    onTranslationEditsChange({});
    await queryClient.invalidateQueries({ queryKey: ADMIN_TRANSLATIONS_KEY });
    setExpected(currentRevision(list));
    setConflict(false);
    setMessage({ tone: 'info', text: 'Loaded the latest live version.' });
  };

  const draftRow = draft.data && !draftHandled ? draft.data : null;
  const busy = saveDraftMutation.isPending || publishMutation.isPending || restoreMutation.isPending;
  const dirty = isNew || scope !== 'none';

  const panel = (
    <>
      {revisionsMissing ? <Text style={styles.warning}>Revision history isn't available yet - migration 20261004000002_content_revisions.sql is not applied on this project. Publishing is disabled until it is.</Text> : null}

      {draftRow ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Saved draft from {new Date(draftRow.updatedAt).toLocaleString()}
            {draftRow.isMine ? ' (yours)' : ''}.{expected !== null && draftRow.baseRevision !== expected ? ' The live version changed after this draft was saved.' : ''}
          </Text>
          <View style={styles.row}>
            <Button
              label="Load draft"
              size="sm"
              variant="secondary"
              onPress={() => {
                onReplaceValues(valuesFromFields(section, draftRow.fields, id), false);
                // null = a draft saved before translations joined drafts: keep live RU/EN.
                onTranslationEditsChange(draftRow.translations ? editsFromTranslations(liveTranslations, draftRow.translations) : {});
                setDraftHandled(true);
              }}
            />
            <Button
              label="Discard draft"
              size="sm"
              variant="secondary"
              onPress={() => {
                void discardDraft(type, id).then(() => queryClient.invalidateQueries({ queryKey: ['admin_draft', type, id] }));
                setDraftHandled(true);
              }}
            />
          </View>
        </View>
      ) : null}

      {!isNew ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Revision history
          </Text>
          {revisions.isLoading ? <Text style={styles.muted}>Loading…</Text> : null}
          {revisions.data && revisions.data.length === 0 ? <Text style={styles.muted}>No revisions yet. The first publish also keeps the current live version as revision 1.</Text> : null}
          {(revisions.data ?? []).map((row) => (
            <AnimatedPressable
              key={row.revisionNumber}
              style={styles.historyRow}
              onPress={() => setViewing(row.revisionNumber)}
              accessibilityRole="button"
              accessibilityLabel={`Revision ${row.revisionNumber}, ${new Date(row.createdAt).toLocaleString()}, ${editorLabel(row)}. ${describeChangedFields(row.changedFields, fieldLabel)}`}
            >
              <Text style={styles.historyTitle}>
                #{row.revisionNumber} · {row.action === 'baseline' ? 'Before history' : row.action === 'restored' ? `Restored from #${row.restoredFrom}` : 'Published'}
                {row.revisionNumber === expected ? ' · live' : ''}
              </Text>
              <Text style={styles.muted}>
                {new Date(row.createdAt).toLocaleString()} · {editorLabel(row)}
              </Text>
              {row.action !== 'baseline' ? <Text style={styles.muted}>{describeChangedFields(row.changedFields, fieldLabel)}</Text> : null}
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
    </>
  );

  const bar = (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Text style={[styles.status, message?.tone === 'error' && styles.error]} numberOfLines={3} accessibilityLiveRegion="polite">
          {busy ? 'Working…' : (message?.text ?? (isNew ? 'New - not published yet' : SCOPE_STATUS[scope]))}
        </Text>
        {conflict ? <Button label="Refresh" size="sm" variant="secondary" onPress={() => setConfirmRefresh(true)} /> : null}
        <Button label="Save draft" size="sm" variant="secondary" disabled={busy || !id || revisionsMissing} onPress={() => saveDraftMutation.mutate()} />
        <Button label="Preview & publish" size="sm" disabled={busy || !dirty || !id || expected === null || revisionsMissing} onPress={() => setPreviewOpen(true)} />
      </View>

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={[styles.modalContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.modalTitle} accessibilityRole="header">
            Preview changes
          </Text>
          <Text style={styles.sectionTitle}>What changes{scope === 'both' ? ' (content + translations, published together)' : scope === 'translations' ? ' (translations only)' : ''}</Text>
          {changes.length === 0 ? <Text style={styles.muted}>No changes.</Text> : changes.map((change) => <Text key={change} style={styles.change}>• {change}</Text>)}
          <Text style={styles.sectionTitle}>Verification & sources</Text>
          <VerificationBadge level={(fields.accuracy_level as 'verified' | 'partially_verified' | 'unverified') ?? 'unverified'} />
          {(Array.isArray(fields.sources) ? (fields.sources as string[]) : []).map((url) => (
            <Text key={url} style={styles.muted} numberOfLines={1}>
              {url}
            </Text>
          ))}
          <Text style={styles.sectionTitle}>As readers will see it (KG / RU / EN)</Text>
          <Text style={styles.muted}>Built from this editor's draft - edited Kyrgyz text and edited RU/EN translations - not from the live version.</Text>
          <ContentPreviewPanel contentType={type} row={{ ...valuesToRow(section, values), id }} translations={previewTranslations} fieldLabel={fieldLabel} />
          {problem ? <Text style={styles.error}>{problem}</Text> : null}
          {message?.tone === 'error' ? <Text style={styles.error}>{message.text}</Text> : null}
          <Button label="Publish" disabled={!!problem || publishMutation.isPending || (!isNew && scope === 'none')} loading={publishMutation.isPending} onPress={() => publishMutation.mutate()} />
          <Button label="Keep editing" variant="secondary" onPress={() => setPreviewOpen(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={viewing !== null} animationType="slide" onRequestClose={() => setViewing(null)}>
        <ScrollView style={styles.modal} contentContainerStyle={[styles.modalContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.modalTitle} accessibilityRole="header">
            Revision #{viewing} (read-only)
          </Text>
          {viewed.isLoading ? <Text style={styles.muted}>Loading…</Text> : null}
          {viewed.error ? <Text style={styles.error}>{revisionErrorMessage(viewed.error as Error)}</Text> : null}
          {viewed.data ? (
            <>
              <VerificationBadge level={(viewed.data.fields.accuracy_level as 'verified' | 'partially_verified' | 'unverified') ?? 'unverified'} />
              {section.fields
                .filter((field) => field.key !== section.idField && viewed.data!.fields[field.key] != null && viewed.data!.fields[field.key] !== '')
                .map((field) => (
                  <View key={field.key} style={{ gap: 2 }}>
                    <Text style={styles.sectionTitle}>{field.label}</Text>
                    <Text style={styles.change}>{Array.isArray(viewed.data!.fields[field.key]) ? (viewed.data!.fields[field.key] as string[]).join('\n') : String(viewed.data!.fields[field.key])}</Text>
                  </View>
                ))}
              <Text style={styles.muted}>Translations in this revision: {viewed.data.translations.length}</Text>
              <Button label="Restore this version" variant="secondary" disabled={viewing === expected || restoreMutation.isPending} onPress={() => setConfirmRestore(true)} />
            </>
          ) : null}
          <Button label="Close" variant="secondary" onPress={() => setViewing(null)} />
        </ScrollView>
        <ConfirmationModal
          visible={confirmRestore}
          title={`Restore revision #${viewing}?`}
          message="Its text, sources, verification level and translations become the live version as a NEW revision. Nothing in the history is deleted."
          confirmLabel="Restore"
          cancelLabel="Cancel"
          isConfirming={restoreMutation.isPending}
          onConfirm={() => viewing !== null && restoreMutation.mutate(viewing)}
          onCancel={() => setConfirmRestore(false)}
        />
      </Modal>

      <ConfirmationModal
        visible={confirmRefresh}
        title="Load the latest version?"
        message="Your unpublished edits on this screen will be replaced. Save a draft first if you want to keep them."
        confirmLabel="Load latest"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void refreshLatest()}
        onCancel={() => setConfirmRefresh(false)}
      />
    </>
  );
  return { panel, bar };
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, paddingTop: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  muted: { ...typography.small, color: colors.textMuted },
  warning: { ...typography.small, color: colors.accentTerracotta },
  error: { ...typography.small, color: colors.danger },
  banner: { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surfaceWarm },
  bannerText: { ...typography.small, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  historyRow: { gap: 2, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  historyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  status: { ...typography.small, color: colors.textSecondary, flex: 1, minWidth: 140 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  change: { ...typography.body, color: colors.textPrimary },
});

/** The editor's scrolling content + the revision panel, with the publish bar below. */
export function RevisionScaffold({ children, contentContainerStyle, ...props }: Parameters<typeof useRevisionWorkflow>[0] & { children: ReactNode; contentContainerStyle: StyleProp<ViewStyle> }) {
  const { panel, bar } = useRevisionWorkflow(props);
  return (
    <>
      <ScrollView contentContainerStyle={contentContainerStyle} keyboardShouldPersistTaps="handled">
        {children}
        {panel}
      </ScrollView>
      {bar}
    </>
  );
}
