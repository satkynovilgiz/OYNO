import { router } from 'expo-router';
import { ChevronLeft, Layers, Palette, Redo2, Shapes, Share2, Undo2, Wand2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LabAboutNote } from '@/features/culture/components/LabAboutNote';

import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { useIsTablet } from '@/hooks/useIsTablet';
import { track } from '@/services/analytics/analytics';
import {
  EMPTY_OYMO_STATE,
  addLayer,
  duplicateLayer,
  removeLayer,
  reorderLayer,
  resetCanvas,
  rotateLayer,
  scaleLayer,
  setBackgroundColor,
  toggleLayerVisibility,
  type OymoEditorState,
} from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { takeCreatorHandoff } from '@/services/culture/oymoHandoff';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { clearSessionRecipe, fingerprint, fitRecipe, recipeFromHistory, setSessionRecipe, type HistoryEntry, type StepLabel } from '@/features/culture/oymo/recipe/recipeModel';
import { recipeFor, useOymoRecipeStore } from '@/store/useOymoRecipeStore';
import { fetchOymoCreations, OYMO_CREATIONS_QUERY_KEY, useOymoCreations, type OymoCreationRow } from '@/services/content/oymoCreationsService';
import { useShareCard } from '@/services/share/useShareCard';
import { useAuthStore } from '@/store/useAuthStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { CANVAS_SIZE, OymoCanvas } from './components/OymoCanvas';
import { ColorSwatches } from './components/ColorSwatches';
import { LayersPanel } from './components/LayersPanel';
import { MotifGrid } from './components/MotifGrid';
import { SaveModal } from './components/SaveModal';
import { SavedPatternsGallery } from './components/SavedPatternsGallery';
import { SymmetryControl } from './components/SymmetryControl';
import { TransformToolbar } from './components/TransformToolbar';
import { OYMO_MOTIFS, type OymoMotifId } from './motifs';

type OymoCreatorScreenProps = {
  onPressBack: () => void;
};

type PanelTab = 'motif' | 'color' | 'symmetry' | 'layers';

export function OymoCreatorScreen({ onPressBack }: OymoCreatorScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const queryClient = useQueryClient();
  const { data: creations } = useOymoCreations();
  const isGuest = useAuthStore((state) => state.status === 'guest');
  const { share, shareHost } = useShareCard();

  // A composition handed over (e.g. a solved Restore puzzle) opens as a new, unsaved design.
  const [handoff] = useState(() => takeCreatorHandoff());
  // Each undo step also records the symmetry in force and what produced it - the Pattern Recipe is this history.
  const [history, setHistory] = useState<HistoryEntry[]>([{ state: handoff?.state ?? EMPTY_OYMO_STATE, symmetry: handoff ? handoff.symmetry : 'fourWay', label: handoff ? 'copy' : 'start' }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const editorState = history[historyIndex].state;
  const symmetryMode = history[historyIndex].symmetry;
  const owner = useRecordsOwner();
  const [includeRecipe, setIncludeRecipe] = useState(false);

  const [selectedMotifId, setSelectedMotifId] = useState<OymoMotifId>(OYMO_MOTIFS[0].id);
  const [selectedColor, setSelectedColor] = useState<string>(colors.primary);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>('motif');
  const [showBackgroundColors, setShowBackgroundColors] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pendingDeleteCreation, setPendingDeleteCreation] = useState<OymoCreationRow | null>(null);
  /** The saved pattern open in the editor, while it is unchanged - the postcard is made from the SAVED copy. */
  const [openedCreationId, setOpenedCreationId] = useState<string | null>(null);

  useEffect(() => {
    void useOymoRecipeStore.getState().load();
    track('oymo_creator_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushEntry(entry: HistoryEntry) {
    setOpenedCreationId(null);
    const truncated = history.slice(0, historyIndex + 1);
    setHistory([...truncated, entry]);
    setHistoryIndex(truncated.length);
  }

  function applyMutation(mutate: (state: OymoEditorState) => OymoEditorState, label: StepLabel, motifId?: string) {
    const next = mutate(editorState);
    if (next === editorState) return;
    pushEntry({ state: next, symmetry: symmetryMode, label, ...(motifId ? { motifId } : {}) });
  }

  /** A symmetry change is an undoable step of its own (and part of the recipe). */
  function setSymmetryMode(mode: SymmetryMode) {
    if (mode === symmetryMode) return;
    pushEntry({ state: editorState, symmetry: mode, label: 'symmetry' });
  }

  /** Replay the CURRENT design (saved or not) in the recipe player. */
  function openSessionRecipe() {
    setSessionRecipe(owner, recipeFromHistory(history, historyIndex));
    router.push('/culture/oymo/recipe?source=session' as never);
  }

  function handleUndo() {
    if (historyIndex === 0) return;
    setHistoryIndex(historyIndex - 1);
    setSelectedLayerId(null);
  }

  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex(historyIndex + 1);
    setSelectedLayerId(null);
  }

  function handlePlace(point: { x: number; y: number }) {
    applyMutation((state) => addLayer(state, point, selectedMotifId, selectedColor), 'place', selectedMotifId);
  }

  function handlePlaceAtCenter() {
    handlePlace({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 });
  }

  function handleSelectLayer(layerId: string) {
    setSelectedLayerId((current) => (current === layerId ? null : layerId));
  }

  function handleReset() {
    setHistory([{ state: EMPTY_OYMO_STATE, symmetry: symmetryMode, label: 'start' }]);
    setHistoryIndex(0);
    setSelectedLayerId(null);
    setShowResetConfirm(false);
    setOpenedCreationId(null);
  }

  function loadCreation(creation: OymoCreationRow) {
    const loaded: OymoEditorState = {
      layers: creation.layers,
      backgroundColor: creation.background_color,
      nextId: creation.layers.length,
    };
    setHistory([{ state: loaded, symmetry: creation.symmetry_mode, label: 'load' }]);
    setHistoryIndex(0);
    setSelectedLayerId(null);
    setOpenedCreationId(creation.id);
  }

  // Shares only the design itself (rendered live), the lab's name and OYNO
  // branding - never the account or anything private.
  function handleShare() {
    void share(
      {
        variant: 'creation',
        title: t('culture.labs.myDesign'),
        label: t('culture.interactive.oymo'),
        imageSource: null,
        artwork: <OymoCanvas layers={editorState.layers} backgroundColor={editorState.backgroundColor} symmetryMode={symmetryMode} selectedLayerId={null} onTapCanvas={() => {}} onSelectLayer={() => {}} />,
        artworkSize: { width: CANVAS_SIZE, height: CANVAS_SIZE },
      },
      t('culture.labs.shareMessage'),
    );
  }

  async function handleSave(name: string) {
    setIsSaving(true);
    setSaveError(false);
    // The save RPC returns no id: note the ids that exist now, so the NEW creation can be found afterwards.
    const before = new Set((queryClient.getQueryData<OymoCreationRow[]>(OYMO_CREATIONS_QUERY_KEY) ?? creations ?? []).map((creation) => creation.id));
    const recipe = includeRecipe ? recipeFromHistory(history, historyIndex) : null;
    const saved = { layers: editorState.layers, backgroundColor: editorState.backgroundColor, symmetry: symmetryMode };
    const success = await useProgressStore.getState().saveOymoCreation({
      name,
      layers: editorState.layers,
      backgroundColor: editorState.backgroundColor,
      symmetryMode,
    });
    setIsSaving(false);
    if (success) {
      setShowSaveModal(false);
      const rows = await queryClient.fetchQuery({ queryKey: OYMO_CREATIONS_QUERY_KEY, queryFn: fetchOymoCreations, staleTime: 0 }).catch(() => null);
      if (recipe && rows) {
        // Optional recipe: attached to the ONE new creation with this content, by its id. If that can't be told
        // apart for certain (none, or several new matches), nothing is attached rather than guessing.
        const print = fingerprint(saved);
        const fresh = rows.filter((row) => !before.has(row.id) && fingerprint({ layers: row.layers, backgroundColor: row.background_color, symmetry: row.symmetry_mode }) === print);
        if (fresh.length === 1) useOymoRecipeStore.getState().saveRecipe(owner, fresh[0].id, recipe);
      }
    } else if (!isGuest) {
      setSaveError(true);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteCreation) return;
    const success = await useProgressStore.getState().deleteOymoCreation(pendingDeleteCreation.id);
    if (success) {
      useOymoRecipeStore.getState().removeFor(owner, pendingDeleteCreation.id);
      queryClient.invalidateQueries({ queryKey: ['oymo_creations'] });
    }
    setPendingDeleteCreation(null);
  }

  const selectedLayer = editorState.layers.find((l) => l.id === selectedLayerId) ?? null;
  const recipes = useOymoRecipeStore((state) => state.saved);
  const recipesLoaded = useOymoRecipeStore((state) => state.isLoaded);
  const openedCreation = creations?.find((creation) => creation.id === openedCreationId) ?? null;
  const openedHasRecipe = !!openedCreation && !!recipeFor(recipes, owner, openedCreation.id);
  // Recipes saved before they were keyed by creation id: adopt only unambiguous ones,
  // once recipe storage has loaded (re-runs when it finishes after the creations).
  useEffect(() => {
    if (creations && recipesLoaded) useOymoRecipeStore.getState().adoptLegacy(owner, creations);
  }, [creations, owner, recipesLoaded]);
  // Another account: an unsaved session recipe from the previous one is dropped.
  const sessionOwner = useRef(owner);
  useEffect(() => {
    if (sessionOwner.current !== owner) clearSessionRecipe();
    sessionOwner.current = owner;
  }, [owner]);
  const recipeFitInfo = (() => {
    const full = recipeFromHistory(history, historyIndex);
    const fitted = fitRecipe(full);
    return { steps: full.steps.length, kept: fitted.steps.length };
  })();

  const panel = (
    <View style={styles.panel}>
      {(isTablet || activeTab === 'motif') && (
        <View style={styles.panelSection}>
          {isTablet && <Text style={styles.panelLabel}>{t('culture.oymo.motifSection')}</Text>}
          <MotifGrid selectedMotifId={selectedMotifId} onSelectMotif={setSelectedMotifId} color={selectedColor} />
        </View>
      )}
      {(isTablet || activeTab === 'color') && (
        <View style={styles.panelSection}>
          {isTablet && <Text style={styles.panelLabel}>{t('culture.oymo.colorSection')}</Text>}
          <ColorSwatches selectedColor={selectedColor} onSelectColor={setSelectedColor} />
        </View>
      )}
      {(isTablet || activeTab === 'symmetry') && (
        <View style={styles.panelSection}>
          {isTablet && <Text style={styles.panelLabel}>{t('culture.oymo.symmetrySection')}</Text>}
          <SymmetryControl mode={symmetryMode} onChangeMode={setSymmetryMode} />
        </View>
      )}
      {(isTablet || activeTab === 'layers') && (
        <View style={styles.panelSection}>
          {isTablet && <Text style={styles.panelLabel}>{t('culture.oymo.layers.title')}</Text>}
          <LayersPanel
            layers={editorState.layers}
            selectedLayerId={selectedLayerId}
            backgroundColor={editorState.backgroundColor}
            onSelectLayer={handleSelectLayer}
            onToggleVisibility={(id) => applyMutation((state) => toggleLayerVisibility(state, id), 'visibility')}
            onReorder={(id, direction) => applyMutation((state) => reorderLayer(state, id, direction), 'reorder')}
            onSelectBackground={() => setShowBackgroundColors((v) => !v)}
          />
          {showBackgroundColors && (
            <View style={styles.backgroundPicker}>
              <ColorSwatches
                selectedColor={editorState.backgroundColor}
                onSelectColor={(color) => applyMutation((state) => setBackgroundColor(state, color), 'background')}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t('culture.oymo.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('culture.oymo.subtitle')}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            label={t('culture.oymo.save.confirm')}
            onPress={() => {
              setSaveError(false);
              setShowSaveModal(true);
            }}
            disabled={editorState.layers.length === 0}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <LabAboutNote lab="oymo" />
        {handoff ? (
          <Text style={styles.handoffNote} testID="oymo-handoff-note">
            {handoff.source === 'symmetry' ? t('symmetryPlayground.openedCopy') : handoff.source === 'recipe' ? t('culture.oymo.recipe.openedCopy') : handoff.source === 'remember' ? t('rememberPattern.openedCopy') : t('restorePattern.openedCopy')}
          </Text>
        ) : null}
        <AnimatedPressable style={styles.restoreEntry} onPress={() => router.push('/culture/oymo/restore' as never)} accessibilityRole="button" accessibilityLabel={`${t('restorePattern.title')}. ${t('restorePattern.entryMeta')}`} testID="restore-entry">
          <Shapes size={18} color={colors.primary} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.restoreTitle}>{t('restorePattern.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('restorePattern.entryMeta')}</Text>
          </View>
        </AnimatedPressable>
        <AnimatedPressable style={styles.restoreEntry} onPress={() => router.push('/culture/oymo/remember' as never)} accessibilityRole="button" accessibilityLabel={`${t('rememberPattern.title')}. ${t('rememberPattern.entryMeta')}`} testID="remember-entry">
          <Shapes size={18} color={colors.primary} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.restoreTitle}>{t('rememberPattern.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('rememberPattern.entryMeta')}</Text>
          </View>
        </AnimatedPressable>
        <AnimatedPressable style={styles.restoreEntry} onPress={() => router.push('/culture/oymo/symmetry' as never)} accessibilityRole="button" accessibilityLabel={`${t('symmetryPlayground.title')}. ${t('symmetryPlayground.entryMeta')}`} testID="symmetry-entry">
          <Wand2 size={18} color={colors.primary} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.restoreTitle}>{t('symmetryPlayground.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('symmetryPlayground.entryMeta')}</Text>
          </View>
        </AnimatedPressable>
        <View style={isTablet ? styles.tabletRow : undefined}>
          {isTablet && panel}

          <View style={styles.canvasColumn}>
            <View style={styles.historyRow}>
              <IconButton icon={Undo2} shape="roundedSquare" accessibilityLabel={t('culture.oymo.undo')} onPress={handleUndo} disabled={historyIndex === 0} />
              <IconButton icon={Redo2} shape="roundedSquare" accessibilityLabel={t('culture.oymo.redo')} onPress={handleRedo} disabled={historyIndex >= history.length - 1} />
              <View style={styles.historySpacer} />
              <IconButton icon={Share2} shape="roundedSquare" accessibilityLabel={t('culture.labs.shareDesign')} onPress={handleShare} disabled={editorState.layers.length === 0} />
            </View>

            <OymoCanvas
              layers={editorState.layers}
              backgroundColor={editorState.backgroundColor}
              symmetryMode={symmetryMode}
              selectedLayerId={selectedLayerId}
              onTapCanvas={handlePlace}
              onSelectLayer={handleSelectLayer}
            />

            {selectedLayer && (
              <TransformToolbar
                onRotate={() => applyMutation((state) => rotateLayer(state, selectedLayer.id), 'rotate')}
                onScaleUp={() => applyMutation((state) => scaleLayer(state, selectedLayer.id), 'scale')}
                onScaleDown={() => applyMutation((state) => scaleLayer(state, selectedLayer.id, -0.15), 'scale')}
                onDuplicate={() => applyMutation((state) => duplicateLayer(state, selectedLayer.id), 'duplicate')}
                onDelete={() => {
                  applyMutation((state) => removeLayer(state, selectedLayer.id), 'remove');
                  setSelectedLayerId(null);
                }}
              />
            )}

            <View style={styles.canvasActions}>
              <Button label={t('culture.oymo.placeAtCenter')} variant="secondary" onPress={handlePlaceAtCenter} />
              <Button label={t('culture.oymo.reset')} variant="secondary" onPress={() => setShowResetConfirm(true)} />
            </View>
          </View>
        </View>

        {!isTablet && (
          <>
            <View style={styles.tabRow}>
              <TabButton icon={Shapes} label={t('culture.oymo.motifSection')} active={activeTab === 'motif'} onPress={() => setActiveTab('motif')} />
              <TabButton icon={Palette} label={t('culture.oymo.colorSection')} active={activeTab === 'color'} onPress={() => setActiveTab('color')} />
              <TabButton icon={Wand2} label={t('culture.oymo.symmetrySection')} active={activeTab === 'symmetry'} onPress={() => setActiveTab('symmetry')} />
              <TabButton icon={Layers} label={t('culture.oymo.layers.title')} active={activeTab === 'layers'} onPress={() => setActiveTab('layers')} />
            </View>
            {panel}
          </>
        )}

        {/* Pattern Recipe: replay how this design was built (this session), or a saved creation's recipe. */}
        {history.length > 1 || historyIndex > 0 ? <Button label={t('culture.oymo.recipe.replayThis')} variant="secondary" onPress={openSessionRecipe} accessibilityHint={t('culture.oymo.recipe.replayThisHint')} testID="oymo-replay-session" /> : null}
        {openedCreationId && openedHasRecipe ? <Button label={t('culture.oymo.recipe.replaySaved')} variant="secondary" onPress={() => router.push(`/culture/oymo/recipe?creation=${encodeURIComponent(openedCreationId)}` as never)} testID="oymo-replay-saved" /> : null}
        {openedCreationId && creations?.some((creation) => creation.id === openedCreationId) ? (
          <Button label={t('postcard.entry')} variant="secondary" onPress={() => router.push(`/culture/oymo/postcard?pattern=${encodeURIComponent(openedCreationId)}` as never)} accessibilityHint={t('postcard.entryHint')} testID="oymo-create-postcard" />
        ) : null}

        <SavedPatternsGallery
          creations={creations ?? []}
          onLoad={loadCreation}
          onDelete={setPendingDeleteCreation}
          onNew={() => setShowResetConfirm(true)}
        />
      </ScrollView>

      <SaveModal
        recipe={{ include: includeRecipe, onChange: setIncludeRecipe, ...recipeFitInfo }}
        visible={showSaveModal}
        defaultName={t('culture.oymo.save.defaultName', { count: (creations?.length ?? 0) + 1 })}
        isSaving={isSaving}
        isGuest={isGuest}
        hasError={saveError}
        onSave={handleSave}
        onCancel={() => setShowSaveModal(false)}
      />

      <ConfirmationModal
        visible={showResetConfirm}
        title={t('culture.oymo.resetConfirm.title')}
        message={t('culture.oymo.resetConfirm.message')}
        confirmLabel={t('culture.oymo.resetConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmationModal
        visible={!!pendingDeleteCreation}
        title={t('culture.oymo.gallery.deleteConfirm.title')}
        message={t('culture.oymo.gallery.deleteConfirm.message')}
        confirmLabel={t('culture.oymo.gallery.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteCreation(null)}
      />
      {shareHost}
    </View>
  );
}

function TabButton({ icon: Icon, label, active, onPress }: { icon: typeof Shapes; label: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Icon size={18} color={active ? colors.primary : colors.textMuted} strokeWidth={2.25} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  handoffNote: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  restoreEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.sm, marginBottom: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  restoreTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  headerActions: {
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  canvasColumn: {
    flex: 1,
    gap: spacing.sm,
    alignItems: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  historySpacer: {
    flex: 1,
  },
  canvasActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  panel: {
    width: 200,
    gap: spacing.md,
  },
  panelSection: {
    gap: spacing.xs,
  },
  panelLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  backgroundPicker: {
    marginTop: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: colors.primary,
  },
});
