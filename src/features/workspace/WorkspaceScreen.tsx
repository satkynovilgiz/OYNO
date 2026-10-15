import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Cloud, Lock, Smartphone } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { SaveStatus, useSaveFeedback } from '@/components/feedback/SaveStatus';
import { LoadingState, SectionError, StateMessage } from '@/components/state/ScreenState';
import { Button, ConfirmationModal, TextField } from '@/components/ui';
import { OymoArtwork } from '@/features/culture/oymo/components/OymoArtwork';
import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { setPreviewSource } from '@/features/culture/oymo/surfaces/surfacesModel';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { buildExhibitionCover, normalizeExhibition, slidesFor } from '@/features/myCollections/museum/museumModel';
import { keepPreview } from '@/features/myCollections/museum/previewModel';
import { useContentResolver, useMyCollections } from '@/features/myCollections/useMyCollections';
import type { WorkspaceNoteDraft } from '@/features/recovery/recoveryModel';
import { useShelfSources } from '@/features/shelf/useShelfSources';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { SupportedLanguage } from '@/i18n';
import { fetchOymoCreations } from '@/services/content/oymoCreationsService';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { formatShortDate, localDateKeyOf } from '@/services/i18n/formatDate';
import { useShareCard } from '@/services/share/useShareCard';
import { ownerExhibition, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { ownerWorkspaces, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { cards, colors, headings, spacing, text } from '@/theme';

import { WORKSPACES_ROUTE } from './openWorkspace';
import { usePortfolioDraftsFor } from './usePortfolioDrafts';
import { actionsFor, NOTE_MAX, noteState, parseProjectKey, relatedDrafts, resolveProject, type ProjectAction, type ProjectRef } from './workspaceModel';

/**
 * /profile/workspaces/<type:id> - one existing project with its own
 * editing, preview and export actions together, a private note, and an
 * honest status: the saved record (where it lives, when it changed) kept
 * apart from any recoverable drafts. The project is read live from its own
 * source and opened in its own screens; the workspace never edits it.
 */
export function WorkspaceScreen({ projectKey, onPressBack }: { projectKey: string; onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const owner = useRecordsOwner();
  const ref = parseProjectKey(projectKey);
  const status = useWorkspaceStore((state) => state.status);
  const saved = useWorkspaceStore((state) => state.saved);
  const sources = useShelfSources(owner);
  useEffect(() => {
    void useWorkspaceStore.getState().load();
  }, []);

  let body: React.ReactNode;
  if (!ref)
    body = (
      <StateMessage kind="notFound" title={t('workspace.notFound')} body={t('workspace.notFoundBody')} action={{ label: t('workspace.allWorkspaces'), onPress: () => router.replace(WORKSPACES_ROUTE as never), testID: 'workspace-all' }} />
    );
  else if (status === 'error')
    body = (
      <StateMessage kind="error" title={t('workspace.loadError')} body={t('states.recordsErrorBody')} action={{ label: t('common.retry'), onPress: () => void useWorkspaceStore.getState().retryLoad(), testID: 'workspace-load-retry' }} />
    );
  else if (status !== 'ready') body = <LoadingState label={t('workspace.loading')} />;
  else {
    const workspace = ownerWorkspaces(saved, owner)[projectKey] ?? null;
    // Keyed by owner: another account's workspace (and its unsaved note) is never shown.
    body = <WorkspaceBody key={`${owner}|${projectKey}`} owner={owner} projectRef={ref} workspace={workspace} resolution={resolveProject(ref, sources)} language={i18n.language as SupportedLanguage} />;
  }
  return (
    <SettingsScreenLayout title={t('workspace.title')} onPressBack={onPressBack}>
      <View testID="workspace-screen">{body}</View>
    </SettingsScreenLayout>
  );
}

type Body = { owner: string; projectRef: ProjectRef; workspace: ReturnType<typeof ownerWorkspaces>[string] | null; resolution: ReturnType<typeof resolveProject>; language: SupportedLanguage };

function WorkspaceBody({ owner, projectRef, workspace, resolution, language }: Body) {
  const { t } = useTranslation();
  const key = `${projectRef.type}:${projectRef.id}`;
  const { share, shareHost } = useShareCard();
  const feedback = useSaveFeedback();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const shownOwner = useRef(owner);
  shownOwner.current = owner;

  // The live record behind the reference (only the current owner's).
  const designs = useQuery({ queryKey: ['oymo_creations', 'shelf', owner], queryFn: fetchOymoCreations, enabled: owner !== 'guest' && projectRef.type === 'design' });
  const designRow = projectRef.type === 'design' ? (designs.data?.find((row) => row.id === projectRef.id) ?? null) : null;
  const { data: collections } = useMyCollections();
  const museums = useMyCollectionsStore((state) => state.museums);
  const { resolve, ready: contentReady } = useContentResolver();
  const portfolioDrafts = usePortfolioDraftsFor(owner);

  const item = resolution.status === 'ready' ? resolution.item : null;
  const title = item ? (item.title ?? t(`shelf.untitled.${projectRef.type}`)) : workspace?.titleSnapshot || t(`shelf.untitled.${projectRef.type}`);

  // Opening refreshes "recently opened" and the title shown on Home (a failure changes nothing visible).
  const touched = useRef(false);
  useEffect(() => {
    if (!workspace || !item || touched.current) return;
    touched.current = true;
    void useWorkspaceStore.getState().change(owner, { kind: 'opened', key, title: item.title ?? '', now: new Date().toISOString() });
  }, [workspace, item, owner, key]);

  /* ---------- the private note: an editor draft kept through pending saves ---------- */
  const drafts = draftMap<WorkspaceNoteDraft>('workspaceNote');
  const draftKey = ownerKey(owner, key);
  const stored = workspace?.note ?? '';
  const [typed, setTyped] = useState<string | null>(() => drafts.get(draftKey)?.note ?? null);
  const note = typed ?? stored;
  const dirty = noteState(note, stored) === 'unsaved';
  const editNote = (value: string) => {
    const next = value.slice(0, NOTE_MAX);
    setTyped(next);
    if (next === stored) drafts.delete(draftKey);
    else drafts.set(draftKey, { note: next, title: item?.title ?? workspace?.titleSnapshot ?? '' });
  };
  const saveNote = async () => {
    const startedFor = owner;
    const sent = drafts.get(draftKey);
    const text = note;
    const ok = await feedback.run(() => useWorkspaceStore.getState().change(startedFor, { kind: 'note', key, note: text, now: new Date().toISOString() }));
    if (shownOwner.current !== startedFor) return;
    // Clear the draft only if it is still exactly what was sent - edits typed meanwhile stay unsaved.
    if (ok && drafts.get(draftKey) === sent) drafts.delete(draftKey);
  };

  const add = async () => {
    setAddFailed(false);
    const ok = await useWorkspaceStore.getState().change(owner, { kind: 'add', ref: projectRef, title: item?.title ?? '', now: new Date().toISOString() });
    if (!ok) setAddFailed(true);
  };
  const remove = async () => {
    setConfirmRemove(false);
    setRemoveFailed(false);
    const ok = await useWorkspaceStore.getState().change(owner, { kind: 'remove', key });
    if (!ok) return setRemoveFailed(true);
    drafts.delete(draftKey);
    router.replace(WORKSPACES_ROUTE as never);
  };

  /* ---------- actions: each opens the project's own screen / share card ---------- */
  const run = (action: ProjectAction) => {
    switch (action.kind) {
      case 'route':
        return router.push(action.route as never);
      case 'surfacePreview':
        if (!designRow) return;
        setPreviewSource(owner, { layers: designRow.layers, backgroundColor: designRow.background_color, symmetry: designRow.symmetry_mode });
        return router.push('/culture/oymo/preview' as never);
      case 'museumPreview':
        // The museum screen opens straight into its existing Visitor Preview.
        keepPreview(owner, projectRef.id, null, 0);
        return router.push(`/profile/my-collections/museum?collection=${encodeURIComponent(projectRef.id)}` as never);
      case 'shareDesign':
        if (!designRow) return;
        // The design and its title only - the private note is never part of a card.
        return void share(
          {
            variant: 'creation',
            title: designRow.name?.trim() || t('culture.labs.myDesign'),
            label: t('culture.interactive.oymo'),
            imageSource: null,
            artwork: <OymoArtwork layers={designRow.layers} backgroundColor={designRow.background_color} symmetryMode={designRow.symmetry_mode} size={CANVAS_SIZE} />,
            artworkSize: { width: CANVAS_SIZE, height: CANVAS_SIZE },
          },
          t('culture.labs.shareMessage'),
        );
      case 'shareExhibition': {
        const exhibition = normalizeExhibition(ownerExhibition(museums, owner, projectRef.id), collections, projectRef.id);
        if (!exhibition) return;
        const slides = slidesFor(exhibition, resolve, contentReady);
        const first = slides.find((entry) => entry.kind === 'exhibit' && entry.content.thumbnail);
        const cover = first && first.kind === 'exhibit' ? (first.content.thumbnail as ImageSourcePropType) : null;
        // The same cover card the museum shares - without the introduction, and never the note.
        return void share(buildExhibitionCover({ title, exhibitCountLabel: t('museum.exhibitCount', { count: exhibition.exhibits.length }), label: t('museum.label'), cover, intro: null }), title);
      }
    }
  };
  const actionDisabled = (action: ProjectAction) => ((action.kind === 'surfacePreview' || action.kind === 'shareDesign') && !designRow) || (action.kind === 'shareExhibition' && !(item?.detail?.params?.count as number));

  const date = (value: string | null) => {
    const day = value ? localDateKeyOf(value) : null;
    return day ? formatShortDate(day, language) : t('shelf.noDate');
  };
  const storageLabel = projectRef.type === 'design' ? t('shelf.storage.cloud') : t('shelf.storage.device');
  const related = relatedDrafts(projectRef, portfolioDrafts);

  let project: React.ReactNode;
  if (resolution.status === 'loading') project = <LoadingState label={t('workspace.projectLoading')} testID="workspace-project-loading" />;
  else if (resolution.status === 'error') project = <SectionError message={t('workspace.projectError')} onRetry={resolution.retry} testID="workspace-project-error" />;
  else if (resolution.status === 'unavailable')
    project = (
      <StateMessage
        kind="unavailable"
        title={resolution.reason === 'signedOut' ? t('workspace.signedOut') : t('workspace.offline')}
        body={resolution.reason === 'signedOut' ? t('shelf.signedOut') : t('workspace.offlineBody')}
        testID="workspace-project-unavailable"
      />
    );
  else if (resolution.status === 'missing')
    project = (
      <StateMessage
        kind="unavailable"
        title={t(`workspace.missing.${projectRef.type}`)}
        body={t('workspace.missingBody')}
        action={workspace ? { label: t('workspace.remove'), onPress: () => setConfirmRemove(true), testID: 'workspace-missing-remove' } : undefined}
        secondary={{ label: t('workspace.toShelf'), onPress: () => router.push('/profile/shelf' as never), testID: 'workspace-missing-shelf' }}
        testID="workspace-project-missing"
      />
    );
  else
    project = (
      <View style={styles.stack}>
        {actionsFor(projectRef).map((group) => (
          // A labelled group per kind of action, so screen readers hear "Edit", "Preview", "Export".
          <View key={group.id} style={styles.group} role="group" aria-label={t(`workspace.groups.${group.id}`)} testID={`workspace-group-${group.id}`}>
            <Text style={styles.groupLabel} accessibilityRole="header">
              {t(`workspace.groups.${group.id}`)}
            </Text>
            {group.actions.map((action) => (
              <Button
                key={action.id}
                label={t(action.labelKey)}
                accessibilityHint={t(action.hintKey)}
                variant={group.id === 'edit' && action.id === 'edit' ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => run(action)}
                disabled={actionDisabled(action)}
                testID={`workspace-action-${action.id}`}
              />
            ))}
          </View>
        ))}
      </View>
    );

  return (
    <View style={styles.stack}>
      <View style={styles.headerCard} testID="workspace-project">
        <Text style={styles.typeLabel}>{t(`shelf.types.${projectRef.type}`)}</Text>
        <Text style={styles.title} accessibilityRole="header" testID="workspace-project-title">
          {title}
        </Text>
      </View>

      {project}

      {/* Saved record vs. recoverable drafts - never mixed. */}
      <View style={styles.card} testID="workspace-status">
        <Text style={styles.section} accessibilityRole="header">
          {t('workspace.statusTitle')}
        </Text>
        <View style={styles.statusRow} testID="workspace-saved-record">
          {projectRef.type === 'design' ? <Cloud size={16} color={colors.textSecondary} /> : <Smartphone size={16} color={colors.textSecondary} />}
          <View style={styles.flex}>
            <Text style={styles.strong}>{t('workspace.savedRecord')}</Text>
            <Text style={styles.meta}>{item ? `${storageLabel} · ${t('shelf.updated', { date: date(item.updatedAt) })}` : storageLabel}</Text>
          </View>
        </View>
        <View style={styles.statusRow} testID="workspace-drafts">
          <View style={styles.flex}>
            <Text style={styles.strong}>{t('workspace.drafts')}</Text>
            {related.map((draft) => (
              <View key={draft.id} style={styles.draftRow} testID={`workspace-draft-${draft.id}`}>
                <Text style={styles.body}>{t('workspace.portfolioDraft', { name: draft.title || t('recovery.untitled') })}</Text>
                <Button label={t('workspace.openDraft')} variant="secondary" size="sm" onPress={() => router.push(draft.route as never)} testID={`workspace-draft-open-${draft.id}`} />
              </View>
            ))}
            {dirty ? <Text style={styles.body}>{t('workspace.noteUnsaved')}</Text> : null}
            {related.length === 0 && !dirty ? <Text style={styles.meta}>{t('workspace.noDrafts')}</Text> : null}
            <Text style={styles.meta}>{t(`workspace.draftRule.${projectRef.type}`)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card} testID="workspace-note">
        <View style={styles.statusRow}>
          <Lock size={16} color={colors.textSecondary} />
          <Text style={[styles.section, styles.flex]} accessibilityRole="header">
            {t('workspace.noteTitle')}
          </Text>
        </View>
        <Text style={styles.meta}>{t('workspace.notePrivate')}</Text>
        {workspace ? (
          <>
            <TextField testID="workspace-note-input" label={t('workspace.noteLabel')} value={note} onChangeText={editNote} multiline numberOfLines={4} placeholder={t('workspace.notePlaceholder')} />
            <Text style={styles.meta} testID="workspace-note-state">
              {dirty ? t('workspace.noteUnsaved') : t('workspace.noteSaved')}
            </Text>
            <Button label={t('workspace.saveNote')} onPress={() => void saveNote()} disabled={!dirty} loading={feedback.saving} testID="workspace-note-save" />
            <SaveStatus state={feedback.state} failedLabel={t('workspace.noteFailed')} testID="workspace-note" />
          </>
        ) : (
          <>
            <Text style={styles.body}>{t('workspace.notAdded')}</Text>
            <Button label={t('workspace.add')} onPress={() => void add()} disabled={resolution.status !== 'ready'} testID="workspace-add" />
            {addFailed ? <SectionError message={t('workspace.addFailed')} onRetry={() => void add()} testID="workspace-add-failed" /> : null}
          </>
        )}
      </View>

      {workspace && resolution.status !== 'missing' ? <Button label={t('workspace.remove')} variant="secondary" onPress={() => setConfirmRemove(true)} testID="workspace-remove" /> : null}
      {removeFailed ? <SectionError message={t('workspace.removeFailed')} onRetry={() => void remove()} testID="workspace-remove-failed" /> : null}
      <Button label={t('workspace.allWorkspaces')} variant="text" onPress={() => router.push(WORKSPACES_ROUTE as never)} testID="workspace-all" />

      <ConfirmationModal
        visible={confirmRemove}
        title={t('workspace.removeTitle')}
        message={t('workspace.removeMessage')}
        confirmLabel={t('workspace.removeConfirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  headerCard: { gap: spacing.xxs },
  typeLabel: { ...headings.label, color: colors.primary },
  title: { ...headings.section, color: colors.textPrimary },
  card: { ...cards.standard, gap: spacing.sm },
  group: { gap: spacing.xs },
  groupLabel: { ...headings.label, color: colors.textSecondary },
  section: { ...headings.label, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  draftRow: { gap: spacing.xs, paddingVertical: spacing.xxs },
  strong: { ...text.emphasis, color: colors.textPrimary },
  body: { ...text.body, color: colors.textPrimary },
  meta: { ...text.meta, color: colors.textSecondary },
});
