import { View } from 'react-native';

import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { getLayerRenderPoints, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

import { getMotifShape } from '../motifs';

/** Shape size and placement box on the live canvas (OymoCanvas). */
const CANVAS_SHAPE = 36;

/**
 * Non-interactive render of a pattern at any size - the live canvas's own
 * geometry (getLayerRenderPoints + the same 36 pt shapes) scaled exactly,
 * without guide lines or selection rings. `transparent` leaves out the
 * pattern's background so it can sit on another colour.
 */
export function OymoArtwork({ layers, backgroundColor, symmetryMode, size, transparent = false }: { layers: MotifLayer[]; backgroundColor: string; symmetryMode: SymmetryMode; size: number; transparent?: boolean }) {
  const scale = size / CANVAS_SIZE;
  const shape = CANVAS_SHAPE * scale;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden', backgroundColor: transparent ? 'transparent' : backgroundColor }}>
      {layers
        .filter((layer) => layer.visible)
        .map((layer) => {
          const Shape = getMotifShape(layer.motifId);
          return getLayerRenderPoints(layer, symmetryMode, CANVAS_SIZE).map((point, index) => (
            <View
              key={`${layer.id}-${index}`}
              style={{ position: 'absolute', left: point.x * scale - shape / 2, top: point.y * scale - shape / 2, width: shape, height: shape, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${layer.rotation}deg` }, { scale: layer.scale }] }}
            >
              <Shape size={shape} color={layer.color} />
            </View>
          ));
        })}
    </View>
  );
}
