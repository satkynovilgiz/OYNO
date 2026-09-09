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

/**
 * Nine motifs added from a Kyrgyz-ornament reference article (super.kg,
 * "Kyrgyzdyn oyularyndagy maanider", author Suiun Kulmatova, expert
 * Sheishembek Mongolodorov). `jalbyrak` (leaf) and `kargaTyrmak` (crow's
 * claw) from that same article were skipped here since matching motifs
 * already existed above. Same disclosure as the rest of this file: only the
 * NAME and cultural meaning are sourced from the article - the shapes are
 * original geometric interpretations, not traced from its photos.
 */
function ItKuiruk({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 20c1-7 4-12 9-15 2 3 1 7-2 9-3 2-6 2-7 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function KochkorMuyuzShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21V13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M12 13c-3 0-5-2-4-5 1-2 3-2 4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 13c3 0 5-2 4-5-1-2-3-2-4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TekeMuyuzShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-1-6 0-11 4-16 1 3 0 6-2 9-1 2-2 4-2 7Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function KazMoyunShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21c-1-6 0-11 3-14 2-2 4-2 5-1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={17} cy={5} r={1.6} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

function BulakShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c3 4 5 7 5 10a5 5 0 01-10 0c0-3 2-6 5-10Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M4 21c2-1 3-1 5 0s3 1 5 0 3-1 5 0" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Umai oyumu (Umai talisman disc) - a sun/moon disc with wings spread on
 * all four sides, distinct from `UmaiEneShape`'s anthropomorphic figure;
 * the article describes this as the flatter, symmetric talisman version
 * applied to clothing and silverwork rather than a figural embroidery. */
function UmaiOyumuShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M9 12c-3-1-5-3-6-6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15 12c3-1 5-3 6-6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 12c-3 1-5 3-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15 12c3 1 5 3 6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Adamdyn juzu (human face) - per the article, sourced from the visual of
 * a headscarf/braid parted in two; rendered as a face outline split by a
 * center part with a braid curling down each side. */
function AdamdynJuzuShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5c0-2 2-3 4-3s4 1 4 3v6c0 4-2 7-4 9-2-2-4-5-4-9V5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 2v9" stroke={color} strokeWidth={1.4} />
      <Path d="M8 6c-1 2-1 4 0 6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M16 6c1 2 1 4 0 6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function MuyuzKyalShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 17c1-4 3-4 3 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M8 17c1-4 3-4 3 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M14 17c1-4 3-4 3 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M20 17c1-4 2-4 2 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Tort kulak (four ears) - a diamond frame (the tunduk/kerege lattice
 * viewed from above) with a small tab at each edge midpoint for the "four
 * ears" that give the motif its name. */
function TortKulakShape({ size = 32, color = '#2F5233' }: OymoMotifShapeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l9 9-9 9-9-9Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 3v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M21 12h-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 21v-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export type OymoMotifId =
  | 'muyuz'
  | 'kargaTyrmak'
  | 'kyal'
  | 'jalbyrak'
  | 'gul'
  | 'umaiEne'
  | 'balykOyuu'
  | 'itKuiruk'
  | 'kochkorMuyuz'
  | 'tekeMuyuz'
  | 'kazMoyun'
  | 'bulak'
  | 'umaiOyumu'
  | 'adamdynJuzu'
  | 'muyuzKyal'
  | 'tortKulak';

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
  { id: 'itKuiruk', nameKey: 'culture.oymo.motifs.itKuiruk', Shape: ItKuiruk },
  { id: 'kochkorMuyuz', nameKey: 'culture.oymo.motifs.kochkorMuyuz', Shape: KochkorMuyuzShape },
  { id: 'tekeMuyuz', nameKey: 'culture.oymo.motifs.tekeMuyuz', Shape: TekeMuyuzShape },
  { id: 'kazMoyun', nameKey: 'culture.oymo.motifs.kazMoyun', Shape: KazMoyunShape },
  { id: 'bulak', nameKey: 'culture.oymo.motifs.bulak', Shape: BulakShape },
  { id: 'umaiOyumu', nameKey: 'culture.oymo.motifs.umaiOyumu', Shape: UmaiOyumuShape },
  { id: 'adamdynJuzu', nameKey: 'culture.oymo.motifs.adamdynJuzu', Shape: AdamdynJuzuShape },
  { id: 'muyuzKyal', nameKey: 'culture.oymo.motifs.muyuzKyal', Shape: MuyuzKyalShape },
  { id: 'tortKulak', nameKey: 'culture.oymo.motifs.tortKulak', Shape: TortKulakShape },
] as const;

export function getMotifShape(motifId: string): ComponentType<OymoMotifShapeProps> {
  return OYMO_MOTIFS.find((m) => m.id === motifId)?.Shape ?? OYMO_MOTIFS[0].Shape;
}
