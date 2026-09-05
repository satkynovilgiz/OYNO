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
 *
 * `umaiEne` and `balykOyuu` were added later, sourced from reference photos
 * + cultural notes supplied directly by the user (not from the migration
 * above): Umai Ene is a sacred Turkic protective-mother/hearth symbol,
 * traditionally embroidered on children's clothing/ak-kalpaks as a ward
 * against illness; Balyk oyuu is a fish-form ornament (Kyrgyz and other
 * Central Asian nomadic art) symbolizing abundance and the continuity of
 * life, seen on shyrdak/tush kiyiz felt work and woodcarving. Same
 * disclosure applies - the SHAPES below are original geometric
 * interpretations, not traced from the reference photos (stored outside
 * the app in assets/img/Oymo/, not bundled or shown in-app).
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

/** Umai Ene - a protective-mother figure: a central body with two arms
 * curving upward in a sheltering embrace and a small head, referencing the
 * motif's role as a child/hearth protection symbol (see the cultural note
 * this shape's name is sourced from). Original geometric interpretation,
 * not a reproduction of the reference photo. */
function UmaiEneShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={2.1} stroke={color} strokeWidth={1.6} />
      {/* Robe/body - a simple rounded bell shape, not a stem, so the arms
          below read as spread wide rather than converging into a goblet. */}
      <Path
        d="M9.5 20c-0.8-4.5-0.6-8 1-11h3c1.6 3 1.8 6.5 1 11Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* Arms - raised outward from the shoulders, spreading wide (a
          sheltering embrace), ending apart rather than meeting at a point. */}
      <Path
        d="M11 10c-2.5 0.5-5 0-6.5-2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 10c2.5 0.5 5 0 6.5-2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Balyk oyuu (fish ornament) - a simple stylized fish silhouette (lens-
 * shaped body, tail, and a scale/gill accent line), matching the abstraction
 * level of the other motifs rather than a literal fish illustration. */
function BalykOyuuShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12c3-6 12-6 15 0-3 6-12 6-15 0Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M18 12l3-3.5v7L18 12Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8 9.5c1 1 1 3.5 0 5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={6.2} cy={11.3} r={0.9} fill={color} />
    </Svg>
  );
}

export type OymoMotifId = 'muyuz' | 'kargaTyrmak' | 'kyal' | 'jalbyrak' | 'gul' | 'umaiEne' | 'balykOyuu';

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
  { id: 'umaiEne', nameKey: 'culture.oymo.motifs.umaiEne', Shape: UmaiEneShape },
  { id: 'balykOyuu', nameKey: 'culture.oymo.motifs.balykOyuu', Shape: BalykOyuuShape },
] as const;

export function getMotifShape(motifId: string): ComponentType<OymoMotifShapeProps> {
  return OYMO_MOTIFS.find((m) => m.id === motifId)?.Shape ?? OYMO_MOTIFS[0].Shape;
}
