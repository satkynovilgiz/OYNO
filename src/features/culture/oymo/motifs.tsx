import { type ComponentType } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type OymoMotifShapeProps = { size?: number; color?: string };

/**
 * Original, purely geometric shapes - NOT reproductions of any verified
 * traditional line art (none exists in the project for these motifs; see
 * the final report's art-asset gap). Only the NAME of each motif is
 * sourced from verified content (culture_items row `oymo-overview`,
 * cultural_meaning field, 20260829000005_boz_uy_oymo_shyrdak_content.sql)
 * - same "verified name, original shape" disclosure pattern already used
 * by src/components/patterns/OymoOrnament.tsx.
 */
function MuyuzShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-4-1-6-5-4-9 1-2 3-3 3-6 0-2-1-3-1-3s4 0 5 4c1 3-1 5-2 7-1 2-1 4 1 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function KargaTyrmakShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21V9" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 9c-2-3-2-6 0-8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 9c0-3 1-6 3-8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 9c2-2 4-2 6-1" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function KyalShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12c2-4 4 4 6 0s4 4 6 0 4 4 6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function JalbyrakShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-6-2-8-10-4-17 6 1 10 7 8 13-1 3-2 4-4 4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 21V6" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function GulShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[0, 72, 144, 216, 288].map((angle) => (
        <Circle
          key={angle}
          cx={12 + 6 * Math.cos((angle * Math.PI) / 180)}
          cy={12 + 6 * Math.sin((angle * Math.PI) / 180)}
          r={4}
          stroke={color}
          strokeWidth={1.5}
        />
      ))}
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </Svg>
  );
}

export type OymoMotifId = 'muyuz' | 'kargaTyrmak' | 'kyal' | 'jalbyrak' | 'gul';

export type OymoMotif = {
  id: OymoMotifId;
  nameKey: string;
  Shape: ComponentType<OymoMotifShapeProps>;
};

export const OYMO_MOTIFS: readonly OymoMotif[] = [
  { id: 'muyuz', nameKey: 'culture.oymo.motifs.muyuz', Shape: MuyuzShape },
  { id: 'kargaTyrmak', nameKey: 'culture.oymo.motifs.kargaTyrmak', Shape: KargaTyrmakShape },
  { id: 'kyal', nameKey: 'culture.oymo.motifs.kyal', Shape: KyalShape },
  { id: 'jalbyrak', nameKey: 'culture.oymo.motifs.jalbyrak', Shape: JalbyrakShape },
  { id: 'gul', nameKey: 'culture.oymo.motifs.gul', Shape: GulShape },
] as const;

export function getMotifShape(motifId: string): ComponentType<OymoMotifShapeProps> {
  return OYMO_MOTIFS.find((m) => m.id === motifId)?.Shape ?? OYMO_MOTIFS[0].Shape;
}
