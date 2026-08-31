import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import type { SymmetryMode } from '@/services/culture/oymoEditor';
import { colors, radii } from '@/theme';

import { getMotifShape } from '../motifs';
import type { MotifPlacement } from '@/services/culture/oymoEditor';

export const CANVAS_SIZE = 300;

type OymoCanvasProps = {
  placements: MotifPlacement[];
  symmetryMode: SymmetryMode;
  onTapCanvas: (point: { x: number; y: number }) => void;
  onTapPlacement: (placementId: string) => void;
};

export function OymoCanvas({ placements, symmetryMode, onTapCanvas, onTapPlacement }: OymoCanvasProps) {
  const { t } = useTranslation();
  const wrapRef = useRef<View>(null);

  // locationX/locationY on Pressable's nativeEvent aren't reliably
  // populated by react-native-web (they came back undefined in manual
  // testing, collapsing every tap to the same NaN point, which in turn
  // made every mirrored point dedupe to one). pageX/pageY are real
  // browser/touch coordinates on every platform, so measuring the
  // canvas's own on-screen position at press time (not cached from
  // onLayout, which can race the very first tap right after mount) and
  // subtracting it is the reliable cross-platform way to get a tap point
  // local to the canvas.
  function handlePress(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    wrapRef.current?.measureInWindow((x, y) => onTapCanvas({ x: pageX - x, y: pageY - y }));
  }

  return (
    <View
      ref={wrapRef}
      style={styles.wrap}
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

      {placements.map((placement) => {
        const Shape = getMotifShape(placement.motifId);
        return (
          <Pressable
            key={placement.id}
            onPress={() => onTapPlacement(placement.id)}
            style={[styles.placement, { left: placement.x - 18, top: placement.y - 18 }]}
            accessibilityRole="button"
            accessibilityLabel={t('culture.oymo.removeMotifLabel')}
            hitSlop={8}
          >
            <Shape size={36} color={placement.color} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignSelf: 'center',
    backgroundColor: colors.surfaceAlt,
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
});
