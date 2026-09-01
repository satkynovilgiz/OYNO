import { ChevronLeft, Layers, Palette, Redo2, Shapes, Undo2, Wand2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useOymoCreations, type OymoCreationRow } from '@/services/content/oymoCreationsService';
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

  const [history, setHistory] = useState<OymoEditorState[]>([EMPTY_OYMO_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const editorState = history[historyIndex];

  const [selectedMotifId, setSelectedMotifId] = useState<OymoMotifId>(OYMO_MOTIFS[0].id);
  const [selectedColor, setSelectedColor] = useState<string>(colors.primary);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('fourWay');
  const [activeTab, setActiveTab] = useState<PanelTab>('motif');
  const [showBackgroundColors, setShowBackgroundColors] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pendingDeleteCreation, setPendingDeleteCreation] = useState<OymoCreationRow | null>(null);

  useEffect(() => {
    track('oymo_creator_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyMutation(mutate: (state: OymoEditorState) => OymoEditorState) {
    const next = mutate(editorState);
    const truncated = history.slice(0, historyIndex + 1);
    setHistory([...truncated, next]);
    setHistoryIndex(truncated.length);
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
    applyMutation((state) => addLayer(state, point, selectedMotifId, selectedColor));
  }

  function handlePlaceAtCenter() {
    handlePlace({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 });
  }

  function handleSelectLayer(layerId: string) {
    setSelectedLayerId((current) => (current === layerId ? null : layerId));
  }

  function handleReset() {
    setHistory([EMPTY_OYMO_STATE]);
    setHistoryIndex(0);
    setSelectedLayerId(null);
    setShowResetConfirm(false);
  }

  function loadCreation(creation: OymoCreationRow) {
    const loaded: OymoEditorState = {
      layers: creation.layers,
      backgroundColor: creation.background_color,
      nextId: creation.layers.length,
    };
    setHistory([loaded]);
    setHistoryIndex(0);
    setSymmetryMode(creation.symmetry_mode);
    setSelectedLayerId(null);
  }

  async function handleSave(name: string) {
    setIsSaving(true);
    setSaveError(false);
    const success = await useProgressStore.getState().saveOymoCreation({
      name,
      layers: editorState.layers,
      backgroundColor: editorState.backgroundColor,
      symmetryMode,
    });
    setIsSaving(false);
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['oymo_creations'] });
      setShowSaveModal(false);
    } else if (!isGuest) {
      setSaveError(true);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteCreation) return;
    const success = await useProgressStore.getState().deleteOymoCreation(pendingDeleteCreation.id);
    if (success) queryClient.invalidateQueries({ queryKey: ['oymo_creations'] });
    setPendingDeleteCreation(null);
  }

  const selectedLayer = editorState.layers.find((l) => l.id === selectedLayerId) ?? null;

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
            onToggleVisibility={(id) => applyMutation((state) => toggleLayerVisibility(state, id))}
            onReorder={(id, direction) => applyMutation((state) => reorderLayer(state, id, direction))}
            onSelectBackground={() => setShowBackgroundColors((v) => !v)}
          />
          {showBackgroundColors && (
            <View style={styles.backgroundPicker}>
              <ColorSwatches
                selectedColor={editorState.backgroundColor}
                onSelectColor={(color) => applyMutation((state) => setBackgroundColor(state, color))}
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
        <View style={isTablet ? styles.tabletRow : undefined}>
          {isTablet && panel}

          <View style={styles.canvasColumn}>
            <View style={styles.historyRow}>
              <IconButton icon={Undo2} shape="roundedSquare" accessibilityLabel={t('culture.oymo.undo')} onPress={handleUndo} disabled={historyIndex === 0} />
              <IconButton icon={Redo2} shape="roundedSquare" accessibilityLabel={t('culture.oymo.redo')} onPress={handleRedo} disabled={historyIndex >= history.length - 1} />
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
                onRotate={() => applyMutation((state) => rotateLayer(state, selectedLayer.id))}
                onScaleUp={() => applyMutation((state) => scaleLayer(state, selectedLayer.id))}
                onScaleDown={() => applyMutation((state) => scaleLayer(state, selectedLayer.id, -0.15))}
                onDuplicate={() => applyMutation((state) => duplicateLayer(state, selectedLayer.id))}
                onDelete={() => {
                  applyMutation((state) => removeLayer(state, selectedLayer.id));
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

        <SavedPatternsGallery
          creations={creations ?? []}
          onLoad={loadCreation}
          onDelete={setPendingDeleteCreation}
          onNew={() => setShowResetConfirm(true)}
        />
      </ScrollView>

      <SaveModal
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
    alignSelf: 'flex-start',
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
