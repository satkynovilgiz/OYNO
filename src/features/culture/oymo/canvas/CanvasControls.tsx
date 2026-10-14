import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { cardRadii, colors, controlStates, headings, layout, radii, spacing, text } from '@/theme';

import { IDENTITY, MAX_ZOOM, MIN_ZOOM, NUDGE_COARSE, NUDGE_FINE, zoomIn, zoomOut, type Viewport } from './canvasViewport';

/** Zoom out / level / zoom in / reset - the same transforms the pinch uses. */
export function ZoomControls({ viewport, size, onChange }: { viewport: Viewport; size: number; onChange: (viewport: Viewport) => void }) {
  const { t } = useTranslation();
  const percent = Math.round(viewport.zoom * 100);
  const set = (next: Viewport) => {
    onChange(next);
    if (next.zoom !== viewport.zoom) AccessibilityInfo.announceForAccessibility(t('canvasView.zoomLevel', { percent: Math.round(next.zoom * 100) }));
  };
  const isIdentity = viewport.zoom === IDENTITY.zoom && viewport.panX === 0 && viewport.panY === 0;
  return (
    <View style={styles.row} testID="oymo-zoom-controls">
      <IconButton icon={ZoomOut} shape="roundedSquare" accessibilityLabel={t('canvasView.zoomOut')} onPress={() => set(zoomOut(viewport, size))} disabled={viewport.zoom <= MIN_ZOOM} testID="oymo-zoom-out" />
      <Text style={styles.level} accessibilityLabel={t('canvasView.zoomLevel', { percent })} testID="oymo-zoom-level">
        {percent}%
      </Text>
      <IconButton icon={ZoomIn} shape="roundedSquare" accessibilityLabel={t('canvasView.zoomIn')} onPress={() => set(zoomIn(viewport, size))} disabled={viewport.zoom >= MAX_ZOOM} testID="oymo-zoom-in" />
      <IconButton icon={Maximize2} shape="roundedSquare" accessibilityLabel={t('canvasView.reset')} onPress={() => set(IDENTITY)} disabled={isIdentity} testID="oymo-zoom-reset" />
      <Text style={styles.hint}>{t('canvasView.gestureHint')}</Text>
    </View>
  );
}

/**
 * Precise positioning of the selected layer in ARTWORK units (0..size): X/Y
 * fields and nudge buttons (1 or 10). Same coordinates as a tap at any zoom.
 */
export function PositionControls({ point, size, onMoveTo, onMoveBy }: { point: { x: number; y: number }; size: number; onMoveTo: (point: { x: number; y: number }) => void; onMoveBy: (dx: number, dy: number) => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(NUDGE_FINE);
  const [draft, setDraft] = useState({ x: String(Math.round(point.x)), y: String(Math.round(point.y)) });
  useEffect(() => setDraft({ x: String(Math.round(point.x)), y: String(Math.round(point.y)) }), [point.x, point.y]);
  const commit = (axis: 'x' | 'y') => {
    const value = Number.parseInt(draft[axis], 10);
    if (!Number.isFinite(value)) return setDraft({ x: String(Math.round(point.x)), y: String(Math.round(point.y)) });
    onMoveTo({ ...point, [axis]: value });
  };
  const field = (axis: 'x' | 'y') => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{axis.toUpperCase()}</Text>
      <TextInput
        style={styles.input}
        value={draft[axis]}
        onChangeText={(value) => setDraft((current) => ({ ...current, [axis]: value.replace(/[^0-9]/g, '').slice(0, 4) }))}
        onBlur={() => commit(axis)}
        onSubmitEditing={() => commit(axis)}
        keyboardType="number-pad"
        returnKeyType="done"
        accessibilityLabel={t(axis === 'x' ? 'canvasView.xLabel' : 'canvasView.yLabel', { max: size })}
        testID={`oymo-position-${axis}`}
      />
    </View>
  );
  return (
    <View style={styles.panel} testID="oymo-position">
      <Text style={styles.title} accessibilityRole="header">
        {t('canvasView.position')}
      </Text>
      <View style={styles.row}>
        {field('x')}
        {field('y')}
      </View>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('canvasView.step')}>
        {[NUDGE_FINE, NUDGE_COARSE].map((value) => (
          <AnimatedPressable
            key={value}
            style={[styles.stepOption, step === value && styles.stepOptionOn]}
            onPress={() => setStep(value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: step === value }}
            aria-checked={step === value}
            accessibilityLabel={t('canvasView.stepValue', { count: value })}
            testID={`oymo-step-${value}`}
          >
            <Text style={[styles.stepText, step === value && styles.stepTextOn]}>{t('canvasView.stepValue', { count: value })}</Text>
          </AnimatedPressable>
        ))}
      </View>
      <View style={styles.row}>
        <IconButton icon={ArrowLeft} shape="roundedSquare" accessibilityLabel={t('canvasView.moveLeft', { count: step })} onPress={() => onMoveBy(-step, 0)} disabled={point.x <= 0} testID="oymo-move-left" />
        <IconButton icon={ArrowUp} shape="roundedSquare" accessibilityLabel={t('canvasView.moveUp', { count: step })} onPress={() => onMoveBy(0, -step)} disabled={point.y <= 0} testID="oymo-move-up" />
        <IconButton icon={ArrowDown} shape="roundedSquare" accessibilityLabel={t('canvasView.moveDown', { count: step })} onPress={() => onMoveBy(0, step)} disabled={point.y >= size} testID="oymo-move-down" />
        <IconButton icon={ArrowRight} shape="roundedSquare" accessibilityLabel={t('canvasView.moveRight', { count: step })} onPress={() => onMoveBy(step, 0)} disabled={point.x >= size} testID="oymo-move-right" />
      </View>
      <Text style={styles.hint}>{t('canvasView.positionNote', { max: size })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  level: { ...text.emphasis, color: colors.textPrimary, minWidth: 52, textAlign: 'center' },
  hint: { ...text.fine, color: colors.textSecondary, textAlign: 'center', flexBasis: '100%' },
  panel: { gap: layout.cardGap, alignSelf: 'stretch', padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  title: { ...headings.label, color: colors.textSecondary, textAlign: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  fieldLabel: { ...text.emphasis, fontWeight: '700', color: colors.textPrimary },
  stepOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  stepOptionOn: { backgroundColor: controlStates.selected.bg, borderColor: controlStates.selected.border },
  stepText: { ...text.meta, fontWeight: '700', color: colors.textPrimary },
  stepTextOn: { color: controlStates.selected.fg },
  input: { ...text.body, minWidth: 72, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, textAlign: 'center' },
});
