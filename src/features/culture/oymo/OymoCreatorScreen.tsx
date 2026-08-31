import { ChevronLeft, Palette, Shapes, Wand2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { useIsTablet } from '@/hooks/useIsTablet';
import { track } from '@/services/analytics/analytics';
import {
  EMPTY_OYMO_STATE,
  placeMotif,
  removeMotif,
  resetCanvas,
  type SymmetryMode,
} from '@/services/culture/oymoEditor';
import { colors, radii, spacing, typography } from '@/theme';

import { CANVAS_SIZE, OymoCanvas } from './components/OymoCanvas';
import { ColorSwatches } from './components/ColorSwatches';
import { MotifGrid } from './components/MotifGrid';
import { SymmetryControl } from './components/SymmetryControl';
import { OYMO_MOTIFS, type OymoMotifId } from './motifs';

type OymoCreatorScreenProps = {
  onPressBack: () => void;
};

type PanelTab = 'motif' | 'color' | 'symmetry';

/**
 * Oymo Creator Phase 1: canvas + single-motif placement + symmetry
 * mirroring only. Layers, transform tools (rotate/resize/duplicate/select
 * handles), undo/redo, and save/load + saved-patterns gallery are Phase
 * 2-4 - explicitly out of scope for this pass (see the plan). No
 * "Сактоо"/"Жаңыдан баштоо" header buttons this phase since there's
 * nothing to save yet - only Reset, which is real and functional.
 */
export function OymoCreatorScreen({ onPressBack }: OymoCreatorScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();

  const [editorState, setEditorState] = useState(EMPTY_OYMO_STATE);
  const [selectedMotifId, setSelectedMotifId] = useState<OymoMotifId>(OYMO_MOTIFS[0].id);
  const [selectedColor, setSelectedColor] = useState<string>(colors.primary);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('fourWay');
  const [activeTab, setActiveTab] = useState<PanelTab>('motif');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    track('oymo_creator_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePlace(point: { x: number; y: number }) {
    setEditorState((state) => placeMotif(state, point, selectedMotifId, selectedColor, symmetryMode, CANVAS_SIZE));
  }

  function handlePlaceAtCenter() {
    handlePlace({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 });
  }

  function handleRemove(placementId: string) {
    setEditorState((state) => removeMotif(state, placementId));
  }

  function handleReset() {
    setEditorState(resetCanvas());
    setShowResetConfirm(false);
  }

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
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={isTablet ? styles.tabletRow : undefined}>
          {isTablet && panel}

          <View style={styles.canvasColumn}>
            <OymoCanvas
              placements={editorState.placements}
              symmetryMode={symmetryMode}
              onTapCanvas={handlePlace}
              onTapPlacement={handleRemove}
            />

            <View style={styles.canvasActions}>
              <Button label={t('culture.oymo.placeAtCenter')} variant="secondary" onPress={handlePlaceAtCenter} />
              <Button label={t('culture.oymo.reset')} variant="secondary" onPress={() => setShowResetConfirm(true)} />
            </View>
          </View>
        </View>

        {!isTablet && (
          <>
            <View style={styles.tabRow}>
              <AnimatedPressable
                style={[styles.tab, activeTab === 'motif' && styles.tabActive]}
                onPress={() => setActiveTab('motif')}
                accessibilityRole="button"
                accessibilityLabel={t('culture.oymo.motifSection')}
                accessibilityState={{ selected: activeTab === 'motif' }}
              >
                <Shapes size={18} color={activeTab === 'motif' ? colors.primary : colors.textMuted} strokeWidth={2.25} />
                <Text style={[styles.tabLabel, activeTab === 'motif' && styles.tabLabelActive]}>{t('culture.oymo.motifSection')}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.tab, activeTab === 'color' && styles.tabActive]}
                onPress={() => setActiveTab('color')}
                accessibilityRole="button"
                accessibilityLabel={t('culture.oymo.colorSection')}
                accessibilityState={{ selected: activeTab === 'color' }}
              >
                <Palette size={18} color={activeTab === 'color' ? colors.primary : colors.textMuted} strokeWidth={2.25} />
                <Text style={[styles.tabLabel, activeTab === 'color' && styles.tabLabelActive]}>{t('culture.oymo.colorSection')}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.tab, activeTab === 'symmetry' && styles.tabActive]}
                onPress={() => setActiveTab('symmetry')}
                accessibilityRole="button"
                accessibilityLabel={t('culture.oymo.symmetrySection')}
                accessibilityState={{ selected: activeTab === 'symmetry' }}
              >
                <Wand2 size={18} color={activeTab === 'symmetry' ? colors.primary : colors.textMuted} strokeWidth={2.25} />
                <Text style={[styles.tabLabel, activeTab === 'symmetry' && styles.tabLabelActive]}>{t('culture.oymo.symmetrySection')}</Text>
              </AnimatedPressable>
            </View>
            {panel}
          </>
        )}
      </ScrollView>

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
    </View>
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
