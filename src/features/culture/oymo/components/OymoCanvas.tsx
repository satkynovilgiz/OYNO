import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Line } from 'react-native-svg';

import { endPan, endPinch, gestureIdle, movePan, movePinch, openGesture, startPan, startPinch, tapAllowed, type GestureSession } from '../canvas/canvasGesture';
import { artworkToScreen, clampArtworkPoint, handleSize, hitLayer, insideFrame, PAN_THRESHOLD, screenToArtwork, TAP_SLOP, type Viewport } from '../canvas/canvasViewport';

import { getLayerRenderPoints, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { colors, radii } from '@/theme';

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

/**
 * Zoom / pan over the SAME artwork. Gestures (react-native-gesture-handler,
 * as on the Explore map): a tap places or selects; a drag pans and a pinch
 * zooms, together, through one composed transform (canvasGesture.ts). The
 * tap only runs when no pan/pinch started (Race) and not right after one,
 * so a pan or pinch can never place a motif. Every screen point is mapped back to artwork
 * coordinates (canvasViewport.ts) - layers never store a screen position.
 * Selection handles are drawn unscaled, so they stay readable at any zoom.
 */
function ZoomableOymoCanvas({ layers, backgroundColor, symmetryMode, selectedLayerId, onTapCanvas, onSelectLayer, viewport, onViewportChange }: OymoCanvasProps & { viewport: Viewport; onViewportChange: (viewport: Viewport) => void }) {
  const { t } = useTranslation();
  const latest = useRef({ viewport, layers, symmetryMode, onTapCanvas, onSelectLayer, onViewportChange });
  latest.current = { viewport, layers, symmetryMode, onTapCanvas, onSelectLayer, onViewportChange };
  // One session for pan + pinch together (canvasGesture.ts): both write one composed transform,
  // so neither gesture's update can undo the other's.
  const session = useRef<GestureSession | null>(null);
  const lastEndedAt = useRef<number | null>(null);
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

  const handleTap = (screen: { x: number; y: number }) => {
    const current = latest.current;
    if (!tapAllowed(session.current !== null, lastEndedAt.current, Date.now())) return;
    if (!insideFrame(screen, CANVAS_SIZE)) return;
    const at = screenToArtwork(screen, current.viewport, CANVAS_SIZE);
    const hit = hitLayer(
      current.layers.map((layer) => ({ id: layer.id, visible: layer.visible, scale: layer.scale, points: getLayerRenderPoints(layer, current.symmetryMode, CANVAS_SIZE) })),
      at,
      MOTIF / 2,
    );
    if (hit) current.onSelectLayer(hit);
    else current.onTapCanvas(clampArtworkPoint(at, CANVAS_SIZE));
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
    .onStart(() => update(startPan))
    .onUpdate((event) => update((current) => movePan(current, { x: event.translationX, y: event.translationY }, CANVAS_SIZE)))
    .onFinalize(() => finish(endPan));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart((event) => update((current) => startPinch(current, { x: event.focalX, y: event.focalY })))
    .onUpdate((event) => update((current) => movePinch(current, event.scale, { x: event.focalX, y: event.focalY }, CANVAS_SIZE)))
    .onFinalize(() => finish(endPinch));
  // Race: the first to activate wins. A tap activates only within TAP_SLOP (< PAN_THRESHOLD), and
  // an active pan/pinch cancels it - so a pan never places. (Exclusive would wait for the pinch to
  // FAIL, which a mouse never does.)
  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  const selected = layers.find((layer) => layer.id === selectedLayerId && layer.visible) ?? null;
  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.wrap, { backgroundColor }]} accessibilityLabel={t('culture.oymo.canvasLabel')} role="group" testID="oymo-canvas">
        <View style={[styles.content, { transform: [{ translateX: viewport.panX }, { translateY: viewport.panY }, { scale: viewport.zoom }] }]} pointerEvents="box-none">
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} pointerEvents="none">
            <SymmetryGuides symmetryMode={symmetryMode} />
          </Svg>
          {layers
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
              style={[
                styles.placement,
                {
                  left: point.x - 18,
                  top: point.y - 18,
                  transform: [{ rotate: `${layer.rotation}deg` }, { scale: layer.scale }],
                },
              ]}
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
  wrap: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignSelf: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  placement: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { position: 'absolute', left: 0, top: 0, width: CANVAS_SIZE, height: CANVAS_SIZE },
  // Unscaled: the same 2 px outline at every zoom.
  handle: { position: 'absolute', borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: 'transparent' },
  selectionRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
});
