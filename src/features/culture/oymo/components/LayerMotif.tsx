import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { MotifLayer } from '@/services/culture/oymoEditor';

import { isCustomId, toGeometry, validateEmbedded } from '../customMotif/customMotifModel';
import type { MotifPrimitive } from '../motifGeometry';
import { getMotifShape } from '../motifs';

/**
 * Draws motif primitives (24-unit grid) exactly like the built-in shape
 * components do - the ONE renderer for custom motifs in the editor
 * preview and in every Creator canvas/artwork.
 */
export function GeometryShape({ primitives, size, color }: { primitives: readonly MotifPrimitive[]; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {primitives.map((p, i) =>
        p.kind === 'path' ? <Path key={i} d={p.d} stroke={color} strokeWidth={p.strokeWidth} strokeLinecap={p.cap} strokeLinejoin={p.join} /> : p.filled ? <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={color} /> : <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} stroke={color} strokeWidth={p.strokeWidth} />,
      )}
    </Svg>
  );
}

/** An embedded custom motif that doesn't validate (unknown version, bad data): a neutral marked placeholder - never another shape. */
export function UnsupportedMotif({ size }: { size: number }) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('customMotif.unsupported')}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={2} y={2} width={20} height={20} stroke="#888" strokeWidth={1.5} strokeDasharray="3 2" />
        <SvgText x={12} y={16} fontSize={12} textAnchor="middle" fill="#888">
          ?
        </SvgText>
      </Svg>
    </View>
  );
}

/** The right shape for a layer: built-in motif, embedded custom motif, or the unsupported placeholder. */
export function LayerMotif({ layer, size }: { layer: Pick<MotifLayer, 'motifId' | 'color' | 'custom'>; size: number }) {
  if (isCustomId(layer.motifId)) {
    const embedded = validateEmbedded(layer.custom);
    return embedded ? <GeometryShape primitives={toGeometry(embedded.primitives)} size={size} color={layer.color} /> : <UnsupportedMotif size={size} />;
  }
  const Shape = getMotifShape(layer.motifId);
  return <Shape size={size} color={layer.color} />;
}
