import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { getLayerRenderPoints, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { colors, radii } from '@/theme';

import { getMotifShape } from '../motifs';

export const CANVAS_SIZE = 300;

type OymoCanvasProps = {
  layers: MotifLayer[];
  backgroundColor: string;
  symmetryMode: SymmetryMode;
  selectedLayerId: string | null;
  onTapCanvas: (point: { x: number; y: number }) => void;
  onSelectLayer: (layerId: string) => void;
};

export function OymoCanvas({ layers, backgroundColor, symmetryMode, selectedLayerId, onTapCanvas, onSelectLayer }: OymoCanvasProps) {
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
      accessibilityRole="image"
    >
      <Pressable onPress={handlePress} style={StyleSheet.absoluteFill} accessibilityRole="none">
        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
          {symmetryMode !== 'none' && (
            <>
              <Line x1={0} y1={0} x2={CANVAS_SIZE} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
              <Line x1={CANVAS_SIZE} y1={0} x2={0} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
              <Line x1={CANVAS_SIZE / 2} y1={0} x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke={colors.surfaceBorder} strokeWidth={1} strokeDasharray="4,4" />
            </>
          )}
        </Svg>
      </Pressable>

      {layers
        .filter((layer) => layer.visible)
        .map((layer) => {
          const Shape = getMotifShape(layer.motifId);
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
              <Shape size={36} color={layer.color} />
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
