import { StyleSheet, View } from 'react-native';

import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { getLayerRenderPoints, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { radii } from '@/theme';

import { getMotifShape } from '../motifs';

const MINI_SIZE = 72;
const SCALE = MINI_SIZE / CANVAS_SIZE;
const MINI_SHAPE_SIZE = 14;

type OymoMiniPreviewProps = {
  layers: MotifLayer[];
  backgroundColor: string;
  symmetryMode: SymmetryMode;
};

/** Non-interactive small render of a saved pattern for the gallery -
 * reuses the exact same layer/mirroring pipeline as the live canvas
 * (getLayerRenderPoints, getMotifShape), just with pre-scaled coordinates
 * and a smaller shape size, rather than a captured screenshot (no new
 * view-shot-style dependency needed). */
export function OymoMiniPreview({ layers, backgroundColor, symmetryMode }: OymoMiniPreviewProps) {
  return (
    <View style={[styles.wrap, { backgroundColor }]}>
      {layers
        .filter((layer) => layer.visible)
        .map((layer) => {
          const Shape = getMotifShape(layer.motifId);
          return getLayerRenderPoints(layer, symmetryMode, CANVAS_SIZE).map((point, index) => (
            <View
              key={`${layer.id}-${index}`}
              style={{
                position: 'absolute',
                left: point.x * SCALE - MINI_SHAPE_SIZE / 2,
                top: point.y * SCALE - MINI_SHAPE_SIZE / 2,
                transform: [{ rotate: `${layer.rotation}deg` }, { scale: layer.scale }],
              }}
            >
              <Shape size={MINI_SHAPE_SIZE} color={layer.color} />
            </View>
          ));
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: MINI_SIZE,
    height: MINI_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
});
