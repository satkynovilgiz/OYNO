/**
 * The Oymo motifs' actual drawing geometry as data (24 x 24 viewBox) - the
 * exact primitives the shape components in motifs.tsx draw. Kept in sync by
 * motifGeometry.test.ts, which renders every shape component and compares.
 * Stencil Studio draws ONLY from this table: an unknown motif id is reported
 * as "can't be outlined", never replaced by another shape.
 *
 * No react-native-svg here, so the model and the PDF export can use it.
 */
export type MotifPrimitive =
  | { kind: 'path'; d: string; strokeWidth: number; cap?: 'round'; join?: 'round' }
  | { kind: 'circle'; cx: number; cy: number; r: number; strokeWidth?: number; filled?: true };

export const MOTIF_VIEWBOX = 24;

export const MOTIF_GEOMETRY: Record<string, readonly MotifPrimitive[]> = {
  muyuz: [
    { kind: 'path', d: 'M12 21c-4-1-6-5-4-9 1-2 3-3 3-6 0-2-1-3-1-3s4 0 5 4c1 3-1 5-2 7-1 2-1 4 1 5', strokeWidth: 2, cap: 'round', join: 'round' },
  ],
  kargaTyrmak: [
    { kind: 'path', d: 'M12 21V9', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M12 9c-2-3-2-6 0-8', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M12 9c0-3 1-6 3-8', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M12 9c2-2 4-2 6-1', strokeWidth: 2, cap: 'round' },
  ],
  kyal: [
    { kind: 'path', d: 'M2 12c2-4 4 4 6 0s4 4 6 0 4 4 6 0', strokeWidth: 2, cap: 'round', join: 'round' },
  ],
  jalbyrak: [
    { kind: 'path', d: 'M12 21c-6-2-8-10-4-17 6 1 10 7 8 13-1 3-2 4-4 4Z', strokeWidth: 2, join: 'round' },
    { kind: 'path', d: 'M12 21V6', strokeWidth: 1.5 },
  ],
  gul: [
    { kind: 'circle', cx: 18, cy: 12, r: 4, strokeWidth: 1.5 },
    { kind: 'circle', cx: 13.854101966249685, cy: 17.706339097770922, r: 4, strokeWidth: 1.5 },
    { kind: 'circle', cx: 7.145898033750316, cy: 15.52671151375484, r: 4, strokeWidth: 1.5 },
    { kind: 'circle', cx: 7.145898033750315, cy: 8.473288486245162, r: 4, strokeWidth: 1.5 },
    { kind: 'circle', cx: 13.854101966249683, cy: 6.293660902229078, r: 4, strokeWidth: 1.5 },
    { kind: 'circle', cx: 12, cy: 12, r: 2.5, filled: true },
  ],
  umaiEne: [
    { kind: 'circle', cx: 12, cy: 5, r: 2.1, strokeWidth: 1.6 },
    { kind: 'path', d: 'M9.5 20c-0.8-4.5-0.6-8 1-11h3c1.6 3 1.8 6.5 1 11Z', strokeWidth: 1.8, join: 'round' },
    { kind: 'path', d: 'M11 10c-2.5 0.5-5 0-6.5-2', strokeWidth: 1.8, cap: 'round', join: 'round' },
    { kind: 'path', d: 'M13 10c2.5 0.5 5 0 6.5-2', strokeWidth: 1.8, cap: 'round', join: 'round' },
  ],
  balykOyuu: [
    { kind: 'path', d: 'M3 12c3-6 12-6 15 0-3 6-12 6-15 0Z', strokeWidth: 2, join: 'round' },
    { kind: 'path', d: 'M18 12l3-3.5v7L18 12Z', strokeWidth: 2, join: 'round' },
    { kind: 'path', d: 'M8 9.5c1 1 1 3.5 0 5', strokeWidth: 1.4, cap: 'round' },
    { kind: 'circle', cx: 6.2, cy: 11.3, r: 0.9, filled: true },
  ],
  itKuiruk: [
    { kind: 'path', d: 'M5 20c1-7 4-12 9-15 2 3 1 7-2 9-3 2-6 2-7 6', strokeWidth: 2, cap: 'round', join: 'round' },
  ],
  kochkorMuyuz: [
    { kind: 'path', d: 'M12 21V13', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M12 13c-3 0-5-2-4-5 1-2 3-2 4 0', strokeWidth: 2, cap: 'round', join: 'round' },
    { kind: 'path', d: 'M12 13c3 0 5-2 4-5-1-2-3-2-4 0', strokeWidth: 2, cap: 'round', join: 'round' },
  ],
  tekeMuyuz: [
    { kind: 'path', d: 'M12 21c-1-6 0-11 4-16 1 3 0 6-2 9-1 2-2 4-2 7Z', strokeWidth: 2, cap: 'round', join: 'round' },
  ],
  kazMoyun: [
    { kind: 'path', d: 'M9 21c-1-6 0-11 3-14 2-2 4-2 5-1', strokeWidth: 2, cap: 'round' },
    { kind: 'circle', cx: 17, cy: 5, r: 1.6, strokeWidth: 1.6 },
  ],
  bulak: [
    { kind: 'path', d: 'M12 3c3 4 5 7 5 10a5 5 0 01-10 0c0-3 2-6 5-10Z', strokeWidth: 2, join: 'round' },
    { kind: 'path', d: 'M4 21c2-1 3-1 5 0s3 1 5 0 3-1 5 0', strokeWidth: 1.4, cap: 'round' },
  ],
  umaiOyumu: [
    { kind: 'circle', cx: 12, cy: 12, r: 3, strokeWidth: 1.8 },
    { kind: 'path', d: 'M9 12c-3-1-5-3-6-6', strokeWidth: 1.6, cap: 'round' },
    { kind: 'path', d: 'M15 12c3-1 5-3 6-6', strokeWidth: 1.6, cap: 'round' },
    { kind: 'path', d: 'M9 12c-3 1-5 3-6 6', strokeWidth: 1.6, cap: 'round' },
    { kind: 'path', d: 'M15 12c3 1 5 3 6 6', strokeWidth: 1.6, cap: 'round' },
  ],
  adamdynJuzu: [
    { kind: 'path', d: 'M8 5c0-2 2-3 4-3s4 1 4 3v6c0 4-2 7-4 9-2-2-4-5-4-9V5Z', strokeWidth: 1.8, join: 'round' },
    { kind: 'path', d: 'M12 2v9', strokeWidth: 1.4 },
    { kind: 'path', d: 'M8 6c-1 2-1 4 0 6', strokeWidth: 1.4, cap: 'round' },
    { kind: 'path', d: 'M16 6c1 2 1 4 0 6', strokeWidth: 1.4, cap: 'round' },
  ],
  muyuzKyal: [
    { kind: 'path', d: 'M2 17c1-4 3-4 3 0', strokeWidth: 1.8, cap: 'round' },
    { kind: 'path', d: 'M8 17c1-4 3-4 3 0', strokeWidth: 1.8, cap: 'round' },
    { kind: 'path', d: 'M14 17c1-4 3-4 3 0', strokeWidth: 1.8, cap: 'round' },
    { kind: 'path', d: 'M20 17c1-4 2-4 2 0', strokeWidth: 1.8, cap: 'round' },
  ],
  tortKulak: [
    { kind: 'path', d: 'M12 3l9 9-9 9-9-9Z', strokeWidth: 2, join: 'round' },
    { kind: 'path', d: 'M12 3v3', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M21 12h-3', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M12 21v-3', strokeWidth: 2, cap: 'round' },
    { kind: 'path', d: 'M3 12h3', strokeWidth: 2, cap: 'round' },
  ],
};

/** A path that ends back where it started (Z) or a circle: an enclosed area that can be coloured in. */
export const isEnclosed = (primitive: MotifPrimitive) => primitive.kind === 'circle' || /z\s*$/i.test(primitive.d);
