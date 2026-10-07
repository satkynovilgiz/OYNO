import { colors } from '@/theme';

import type { OymoMotifId } from '../motifs';

/**
 * "Restore the Pattern" - six authored puzzles on a 3x3 board (slots 0-8,
 * row by row), using the Oymo Creator's own motifs and colours. A piece is
 * a motif in a colour, turned in 90-degree steps.
 *
 * Visual rotational symmetry (read off each motif's SVG geometry in
 * ../motifs.tsx, about its centre 12,12):
 *   tortKulak  - diamond with a tab at each edge midpoint: identical at
 *                every 90-degree turn -> order 4;
 *   umaiOyumu  - centre ring with four wings: a 180-degree turn maps each
 *                wing path exactly onto the opposite one -> order 2;
 *   everything else - no 90-degree-step symmetry (gul's five petals are
 *                five-fold, which never lines up with 90 degrees) -> order 1.
 * Rotations a motif looks identical under are the SAME answer.
 */
export const ROTATION_ORDER: Partial<Record<OymoMotifId, 1 | 2 | 4>> = { tortKulak: 4, umaiOyumu: 2 };
export const rotationOrder = (motifId: string): 1 | 2 | 4 => ROTATION_ORDER[motifId as OymoMotifId] ?? 1;

/** The Creator's own swatches, with a NAME - colour is never the only cue. */
export const PIECE_COLORS = { green: colors.primary, gold: colors.accentGold, brown: colors.accentBrown } as const;
export type PieceColor = keyof typeof PIECE_COLORS;

export type Rotation = 0 | 90 | 180 | 270;
export type Placement = { slot: number; motifId: OymoMotifId; color: PieceColor; rotation: Rotation };

export type RestorePuzzle = {
  id: string;
  /** Slots shown already in place (cannot be moved). */
  fixed: Placement[];
  /** Where the player's pieces must end up. */
  target: Placement[];
  /** How the player's pieces start in the tray (same motifs/colours as `target`, own starting turn). */
  trayRotations: Rotation[];
};

const p = (slot: number, motifId: OymoMotifId, color: PieceColor, rotation: Rotation = 0): Placement => ({ slot, motifId, color, rotation });

export const RESTORE_PUZZLES: RestorePuzzle[] = [
  // 1 - two pieces, already the right way round: just place them.
  { id: 'twin-horns', fixed: [p(4, 'tortKulak', 'green')], target: [p(3, 'kochkorMuyuz', 'brown'), p(5, 'kochkorMuyuz', 'brown')], trayRotations: [0, 0] },
  // 2 - three pieces; one must be turned upside down.
  { id: 'spring', fixed: [p(4, 'umaiOyumu', 'green')], target: [p(1, 'bulak', 'brown'), p(7, 'bulak', 'brown', 180), p(3, 'jalbyrak', 'gold')], trayRotations: [0, 0, 0] },
  // 3 - four horns around the centre, each pointing outwards (four different turns).
  { id: 'four-horns', fixed: [p(4, 'tortKulak', 'gold')], target: [p(1, 'kochkorMuyuz', 'green'), p(5, 'kochkorMuyuz', 'green', 90), p(7, 'kochkorMuyuz', 'green', 180), p(3, 'kochkorMuyuz', 'green', 270)], trayRotations: [0, 0, 0, 0] },
  // 4 - the talisman disc is placed by the player (its 90 and 270 look the same), plus four leaves in the corners.
  { id: 'talisman', fixed: [], target: [p(4, 'umaiOyumu', 'brown', 90), p(0, 'jalbyrak', 'green'), p(2, 'jalbyrak', 'green', 90), p(8, 'jalbyrak', 'green', 180), p(6, 'jalbyrak', 'green', 270)], trayRotations: [0, 0, 0, 0, 0] },
  // 5 - two colours, two rows facing each other, mother-protector in the centre.
  { id: 'goose-border', fixed: [p(4, 'umaiEne', 'brown')], target: [p(0, 'kazMoyun', 'green'), p(1, 'kazMoyun', 'gold'), p(2, 'kazMoyun', 'green'), p(6, 'kazMoyun', 'green', 180), p(7, 'kazMoyun', 'gold', 180), p(8, 'kazMoyun', 'green', 180)], trayRotations: [90, 0, 270, 0, 90, 180] },
  // 6 - a full medallion: nothing given, three motifs, two colours, every turn.
  {
    id: 'medallion',
    fixed: [],
    target: [
      p(4, 'tortKulak', 'gold'),
      p(1, 'kochkorMuyuz', 'brown'),
      p(5, 'kochkorMuyuz', 'brown', 90),
      p(7, 'kochkorMuyuz', 'brown', 180),
      p(3, 'kochkorMuyuz', 'brown', 270),
      p(0, 'itKuiruk', 'green'),
      p(2, 'itKuiruk', 'green', 90),
      p(8, 'itKuiruk', 'green', 180),
      p(6, 'itKuiruk', 'green', 270),
    ],
    trayRotations: [90, 0, 180, 270, 90, 180, 0, 270, 90],
  },
];

/** The motif's existing culture article (oymo-* items) - for "Read about it". */
export const MOTIF_ARTICLES: Partial<Record<OymoMotifId, string>> = {
  kochkorMuyuz: 'oymo-kochkor-muyuz',
  umaiEne: 'oymo-umai-ene',
  kazMoyun: 'oymo-kaz-moyun',
  itKuiruk: 'oymo-it-kuiruk',
  tekeMuyuz: 'oymo-teke-muyuz',
  bulak: 'oymo-bulak',
  umaiOyumu: 'oymo-umai-oyumu',
  adamdynJuzu: 'oymo-adamdyn-juzu',
  muyuzKyal: 'oymo-muyuz-kyal',
  tortKulak: 'oymo-tort-kulak',
  balykOyuu: 'oymo-balyk-oyuu',
};

/** Motifs with a REVIEWED description in all three languages (culture item
 * cultural_meaning: KG source + content/translations RU/EN). Others show
 * only their name and the article link - no meaning is written here. */
export const DESCRIBED_MOTIFS: OymoMotifId[] = ['kochkorMuyuz', 'umaiEne', 'kazMoyun'];
