import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Line } from 'react-native-svg';

import { endPan, endPinch, gestureIdle, movePan, movePinch, openGesture, startPan, startPinch, tapAllowed, type GestureSession } from '../canvas/canvasGesture';
import { GuidesOverlay } from '../guides/GuidesOverlay';
import { dragPoint, placePoint, startDrag, type DragStart, type GuideKind, type GuideSettings, type SnapResult } from '../guides/compositionGuides';
import { artworkToScreen, handleSize, hitLayer, insideFrame, PAN_THRESHOLD, screenToArtwork, TAP_SLOP, type Viewport } from '../canvas/canvasViewport';

import { getLayerRenderPoints, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { colors, radii, spacing, text } from '@/theme';

import { LayerMotif } from './LayerMotif';

export const CANVAS_SIZE = 300;

type OymoCanvasProps = {
  layers: MotifLayer[];
  backgroundColor: string;
  symmetryMode: SymmetryMode;
  selectedLayerId: string | null;
  onTapCanvas: (point: { x: number; y: number }) => void;
  onSelectLayer: (layerId: string) => void;
  /** Zoom / pan (Creator only). Without it the canvas is the plain, fixed view used everywhere else (and by exports). */
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  /** Composition guides (Creator only; session state, never part of the artwork). */
  guides?: GuideSettings;
  /** Preview: guides, symmetry lines and selection hidden; taps and drags don't edit. */
  preview?: boolean;
  /** A drag of the selected layer, committed once when the finger lifts (one Undo / recipe step). */
  onMoveLayer?: (layerId: string, point: { x: number; y: number }) => void;
};

const MOTIF = 36;

export function OymoCanvas(props: OymoCanvasProps) {
  if (props.onViewportChange) return <ZoomableOymoCanvas {...props} viewport={props.viewport ?? { zoom: 1, panX: 0, panY: 0 }} onViewportChange={props.onViewportChange} />;
  return <PlainOymoCanvas {...props} />;
}

function SymmetryGuides({ symmetryMode }: { symmetryMode: SymmetryMode }) {
  if (symmetryMode === 'none') return null;
  return (
    <>
      <Line x1={0} y1={0} x2={CANVAS_SIZE} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
      <Line x1={CANVAS_SIZE} y1={0} x2={0} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
      <Line x1={CANVAS_SIZE / 2} y1={0} x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
    </>
  );
}

const NO_GUIDES: GuideSettings = { grid: false, axes: false, margins: false, spacing: 25, snap: false };

/** Holding Alt / Option (web, hardware keyboards) places freely - snapping is off while it is held. */
function useFreePlacementKey() {
  const held = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Alt') held.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Alt') held.current = false;
    };
    const blur = () => {
      held.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return held;
}

/**
 * Zoom / pan over the SAME artwork. Gestures (react-native-gesture-handler,
 * as on the Explore map): a tap places or selects; a drag pans and a pinch
 * zooms, together, through one composed transform (canvasGesture.ts). The
 * tap only runs when no pan/pinch started (Race) and not right after one,
 * so a pan or pinch can never place a motif. A drag that STARTS on the
 * selected motif (or one of its mirrored copies) moves that motif instead of
 * the view; it is shown live and committed once, when the finger lifts.
 * Every screen point is mapped back to artwork coordinates
 * (canvasViewport.ts) and snapped there (compositionGuides.ts) - layers
 * never store a screen position, and zoom never changes where a point snaps.
 * Selection handles are drawn unscaled, so they stay readable at any zoom.
 */
function ZoomableOymoCanvas({
  layers,
  backgroundColor,
  symmetryMode,
  selectedLayerId,
  onTapCanvas,
  onSelectLayer,
  viewport,
  onViewportChange,
  guides = NO_GUIDES,
  preview = false,
  onMoveLayer,
}: OymoCanvasProps & { viewport: Viewport; onViewportChange: (viewport: Viewport) => void }) {
  const { t } = useTranslation();
  const freeHeld = useFreePlacementKey();
  const latest = useRef({ viewport, layers, symmetryMode, onTapCanvas, onSelectLayer, onViewportChange, guides, preview, onMoveLayer, selectedLayerId });
  latest.current = { viewport, layers, symmetryMode, onTapCanvas, onSelectLayer, onViewportChange, guides, preview, onMoveLayer, selectedLayerId };
  // One session for pan + pinch together (canvasGesture.ts): both write one composed transform,
  // so neither gesture's update can undo the other's.
  const session = useRef<GestureSession | null>(null);
  const lastEndedAt = useRef<number | null>(null);
  /** The selected layer being dragged: live position (not yet in the design) and what it snapped to. */
  const drag = useRef<{ start: DragStart; result: SnapResult | null } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const [moving, setMoving] = useState<{ layerId: string; result: SnapResult } | null>(null);
  /** The last snap, shown until the next gesture or a settings change. */
  const [snapped, setSnapped] = useState<{ x: GuideKind | null; y: GuideKind | null; point: { x: number; y: number } } | null>(null);
  useEffect(() => setSnapped(null), [guides.grid, guides.axes, guides.margins, guides.spacing, guides.snap, preview]);

  const update = (change: (current: GestureSession) => GestureSession) => {
    const wasActive = session.current !== null;
    const current = session.current ?? openGesture(latest.current.viewport, CANVAS_SIZE);
    const next = change(current);
    session.current = gestureIdle(next) ? null : next;
    if (wasActive && !session.current) lastEndedAt.current = Date.now();
    if (next.viewport !== current.viewport) latest.current.onViewportChange(next.viewport);
  };
  const finish = (change: (current: GestureSession) => GestureSession) => {
    if (session.current) update(change);
  };
  const report = (result: SnapResult) => setSnapped(result.x || result.y ? { x: result.x, y: result.y, point: result.point } : null);

  const handleTap = (screen: { x: number; y: number }) => {
    const current = latest.current;
    if (!tapAllowed(session.current !== null || drag.current !== null, lastEndedAt.current, Date.now())) return;
    if (current.preview || !insideFrame(screen, CANVAS_SIZE)) return;
    const at = screenToArtwork(screen, current.viewport, CANVAS_SIZE);
    const hit = hitLayer(
      current.layers.map((layer) => ({ id: layer.id, visible: layer.visible, scale: layer.scale, points: getLayerRenderPoints(layer, current.symmetryMode, CANVAS_SIZE) })),
      at,
      MOTIF / 2,
    );
    if (hit) return current.onSelectLayer(hit);
    const result = placePoint(at, current.guides, CANVAS_SIZE, freeHeld.current);
    report(result);
    current.onTapCanvas(result.point);
  };

  /** Does a drag starting at this screen point grab the selected layer? */
  const grab = (screen: { x: number; y: number }) => {
    const current = latest.current;
    if (current.preview || !current.onMoveLayer || !insideFrame(screen, CANVAS_SIZE)) return null;
    const layer = current.layers.find((entry) => entry.id === current.selectedLayerId && entry.visible);
    if (!layer) return null;
    const at = screenToArtwork(screen, current.viewport, CANVAS_SIZE);
    if (!hitLayer([{ id: layer.id, visible: true, scale: layer.scale, points: getLayerRenderPoints(layer, current.symmetryMode, CANVAS_SIZE) }], at, MOTIF / 2)) return null;
    return startDrag(layer.id, layer.point, at, current.symmetryMode, CANVAS_SIZE);
  };
  // The pointer's own position (not the pan translation, which on web leaves out the movement before
  // the pan activated) - the grab offset from the touch-down point keeps the motif under the finger.
  const dragTo = (pointer: { x: number; y: number }) => {
    const current = drag.current;
    if (!current) return;
    const at = screenToArtwork(pointer, latest.current.viewport, CANVAS_SIZE);
    const result = dragPoint(current.start, at, latest.current.guides, CANVAS_SIZE, freeHeld.current);
    current.result = result;
    setMoving({ layerId: current.start.layerId, result });
    report(result);
  };
  const endDrag = () => {
    const current = drag.current;
    drag.current = null;
    setMoving(null);
    if (!current) return;
    lastEndedAt.current = Date.now();
    if (current.result) latest.current.onMoveLayer?.(current.start.layerId, current.result.point);
  };

  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .runOnJS(true)
    .onEnd((event, success) => {
      if (success) handleTap({ x: event.x, y: event.y });
    });
  const pan = Gesture.Pan()
    .minDistance(PAN_THRESHOLD)
    .runOnJS(true)
    .onBegin((event) => {
      downAt.current = { x: event.x, y: event.y };
    })
    .onStart((event) => {
      setSnapped(null);
      const down = downAt.current ?? { x: event.x - event.translationX, y: event.y - event.translationY };
      const start = grab(down);
      if (start) drag.current = { start, result: null };
      else update(startPan);
    })
    .onUpdate((event) => {
      if (drag.current) dragTo({ x: event.x, y: event.y });
      else update((current) => movePan(current, { x: event.translationX, y: event.translationY }, CANVAS_SIZE));
    })
    .onFinalize(() => {
      downAt.current = null;
      if (drag.current) endDrag();
      else finish(endPan);
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart((event) => update((current) => startPinch(current, { x: event.focalX, y: event.focalY })))
    .onUpdate((event) => update((current) => movePinch(current, event.scale, { x: event.focalX, y: event.focalY }, CANVAS_SIZE)))
    .onFinalize(() => finish(endPinch));
  // Race: the first to activate wins. A tap activates only within TAP_SLOP (< PAN_THRESHOLD), and
  // an active pan/pinch cancels it - so a pan never places. (Exclusive would wait for the pinch to
  // FAIL, which a mouse never does.)
  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  // The dragged layer is drawn at its live position; the design itself changes only on release.
  const shown = moving ? layers.map((layer) => (layer.id === moving.layerId ? { ...layer, point: moving.result.point } : layer)) : layers;
  const selected = preview ? null : (shown.find((layer) => layer.id === selectedLayerId && layer.visible) ?? null);
  const highlight = snapped && !preview ? { x: snapped.x ? snapped.point.x : null, y: snapped.y ? snapped.point.y : null } : null;
  const snapKind = snapped ? (snapped.x === 'axis' || snapped.y === 'axis' ? 'axis' : snapped.x === 'margin' || snapped.y === 'margin' ? 'margin' : 'grid') : null;
  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={[styles.wrap, { backgroundColor }]} accessibilityLabel={t('culture.oymo.canvasLabel')} role="group" testID="oymo-canvas">
          <View style={[styles.content, { transform: [{ translateX: viewport.panX }, { translateY: viewport.panY }, { scale: viewport.zoom }] }]} pointerEvents="box-none">
            {preview ? null : (
              <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} pointerEvents="none">
                <SymmetryGuides symmetryMode={symmetryMode} />
              </Svg>
            )}
            {shown
              .filter((layer) => layer.visible)
              .map((layer) =>
                getLayerRenderPoints(layer, symmetryMode, CANVAS_SIZE).map((point, index) => (
                  // Pointer taps are hit-tested by the canvas gesture; the button stays for keyboards and screen readers.
                  <Pressable
                    key={`${layer.id}-${index}`}
                    onPress={() => onSelectLayer(layer.id)}
                    pointerEvents="none"
                    style={[styles.placement, { left: point.x - MOTIF / 2, top: point.y - MOTIF / 2, transform: [{ rotate: `${layer.rotation}deg` }, { scale: layer.scale }] }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('culture.oymo.selectMotifLabel')}
                    accessibilityState={{ selected: layer.id === selectedLayerId }}
                  >
                    <LayerMotif layer={layer} size={MOTIF} />
                  </Pressable>
                )),
              )}
            {preview ? null : <GuidesOverlay settings={guides} size={CANVAS_SIZE} zoom={viewport.zoom} symmetryMode={symmetryMode} highlight={highlight} />}
          </View>
          {selected
            ? getLayerRenderPoints(selected, symmetryMode, CANVAS_SIZE).map((point, index) => {
                const at = artworkToScreen(point, viewport, CANVAS_SIZE);
                const size = handleSize(MOTIF, selected.scale, viewport.zoom);
                return <View key={`handle-${index}`} pointerEvents="none" style={[styles.handle, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2 }]} testID={`oymo-handle-${index}`} />;
              })
            : null}
        </View>
      </GestureDetector>
      {/* The snapping indicator: the guide lines light up on the canvas, and this line says which (and where). */}
      <View style={styles.indicatorRow} accessibilityLiveRegion="polite" aria-live="polite">
        {snapped && snapKind && !preview ? (
          <Text style={styles.indicator} testID="oymo-snap-indicator">
            {t(`guides.snapped.${snapKind}`, { x: snapped.point.x, y: snapped.point.y })}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function PlainOymoCanvas({ layers, backgroundColor, symmetryMode, selectedLayerId, onTapCanvas, onSelectLayer }: OymoCanvasProps) {
  const { t } = useTranslation();
  const wrapRef = useRef<View>(null);

  // locationX/locationY on Pressable's nativeEvent aren't reliably
  // populated by react-native-web (confirmed in V1 manual testing -
  // collapsed every tap to the same NaN point). pageX/pageY are real
  // browser/touch coordinates on every platform, so measuring the canvas's
  // own on-screen position at press time (not cached from onLayout, which
  // can race the very first tap right after mount) and subtracting it is
  // the reliable cross-platform way to get a tap point local to the canvas.
  function handlePress(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    wrapRef.current?.measureInWindow((x, y) => onTapCanvas({ x: pageX - x, y: pageY - y }));
  }

  return (
    <View
      ref={wrapRef}
      style={[styles.wrap, { backgroundColor }]}
      accessibilityLabel={t('culture.oymo.canvasLabel')}
      // A labelled GROUP: it contains motif buttons, and an "image" can't contain interactive controls.
      role="group"
    >
      <Pressable onPress={handlePress} style={StyleSheet.absoluteFill} accessibilityRole="none">
        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
          <SymmetryGuides symmetryMode={symmetryMode} />
        </Svg>
      </Pressable>

      {layers
        .filter((layer) => layer.visible)
        .map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          return getLayerRenderPoints(layer, symmetryMode, CANVAS_SIZE).map((point, index) => (
            <Pressable
              key={`${layer.id}-${index}`}
              onPress={() => onSelectLayer(layer.id)}
              style={[styles.placement, { left: point.x - 18, top: point.y - 18, transform: [{ rotate: `${layer.rotation}deg` }, { scale: layer.scale }] }]}
              accessibilityRole="button"
              accessibilityLabel={t('culture.oymo.selectMotifLabel')}
              accessibilityState={{ selected: isSelected }}
              hitSlop={8}
            >
              {isSelected && <View style={styles.selectionRing} pointerEvents="none" />}
              <LayerMotif layer={layer} size={36} />
            </Pressable>
          ));
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: CANVAS_SIZE, height: CANVAS_SIZE, alignSelf: 'center', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: 'hidden' },
  placement: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { position: 'absolute', left: 0, top: 0, width: CANVAS_SIZE, height: CANVAS_SIZE },
  indicatorRow: { minHeight: 20, alignSelf: 'center', marginTop: spacing.xxs },
  indicator: { ...text.meta, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  // Unscaled: the same 2 px outline at every zoom.
  handle: { position: 'absolute', borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: 'transparent' },
  selectionRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed' },
});
