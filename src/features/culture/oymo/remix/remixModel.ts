import { CANVAS_SIZE } from '@/features/culture/oymo/components/OymoCanvas';
import { setBackgroundColor, type MotifLayer, type OymoEditorState } from '@/services/culture/oymoEditor';
import { computeMirroredPoints, type SymmetryMode } from '@/services/culture/symmetry';
import { colors } from '@/theme';

/**
 * Oymo Remix Studio - pure rules. A variation is the ORIGINAL design with
 * up to three of the Creator's own supported changes applied: a curated
 * palette (layer colours), a background colour (the Creator's
 * setBackgroundColor) and a symmetry mode (the Creator's render-time
 * computeMirroredPoints). Nothing new is invented: the same motifs stay at
 * the same places. Every function returns a fresh deep copy; the original
 * (and its saved recipe) is never touched.
 *
 * Variations describe only what changed ("Background changed", "Mirror
 * symmetry applied") - never a meaning. Palette names describe colours.
 */
export type RemixDesign = { layers: MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode };
export type RemixChoice = { palette: PaletteId | null; background: string | null; symmetry: SymmetryMode | null };
export const NO_CHANGE: RemixChoice = { palette: null, background: null, symmetry: null };

export type PaletteId = 'greens' | 'earth' | 'goldBrown' | 'darkLight';
/** A small curated set; colours are mapped onto the design's colours in order of first use. */
export const PALETTES: { id: PaletteId; colors: string[] }[] = [
  { id: 'greens', colors: [colors.primary, colors.primaryMuted, colors.surfaceFeature] },
  { id: 'earth', colors: [colors.accentTerracotta, colors.accentBrown, colors.accentTerracottaDark] },
  { id: 'goldBrown', colors: [colors.accentGold, colors.accentBrownDark, colors.accentGoldPressed] },
  { id: 'darkLight', colors: [colors.textPrimary, colors.surface, colors.textSecondary] },
];
export const REMIX_BACKGROUNDS: string[] = [colors.surfaceAlt, colors.surface, colors.surfaceFeature, colors.accentGold];
export const REMIX_MODES: SymmetryMode[] = ['none', 'mirror', 'fourWay'];
const RANK: Record<SymmetryMode, number> = { none: 0, mirror: 1, fourWay: 2 };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const copyLayers = (layers: readonly MotifLayer[]) => layers.map((layer) => ({ ...layer, point: { ...layer.point } }));
export const copyDesign = (design: RemixDesign): RemixDesign => ({ layers: copyLayers(design.layers), backgroundColor: design.backgroundColor, symmetry: design.symmetry });

/** The design's distinct layer colours, in order of first use. */
export function designColors(layers: readonly MotifLayer[]): string[] {
  const seen: string[] = [];
  for (const layer of layers) if (!seen.some((color) => same(color, layer.color))) seen.push(layer.color);
  return seen;
}

/* ---------- symmetry already present in the layers ---------- */

const key = (layer: MotifLayer, x: number, y: number) => `${layer.motifId}|${layer.color.toLowerCase()}|${layer.rotation}|${layer.scale}|${layer.visible}|${Math.round(x)},${Math.round(y)}`;

/**
 * Groups layers whose POINTS are each other's mirror copies under `mode`
 * (same motif, colour, rotation, scale, visibility). Returns the groups,
 * or null when some layer lacks one of its copies - i.e. the layers are not
 * "baked" for that mode.
 */
function orbits(layers: readonly MotifLayer[], mode: SymmetryMode): MotifLayer[][] | null {
  const pool = new Map<string, MotifLayer[]>();
  for (const layer of layers) {
    const k = key(layer, layer.point.x, layer.point.y);
    pool.set(k, [...(pool.get(k) ?? []), layer]);
  }
  const used = new Set<string>();
  const groups: MotifLayer[][] = [];
  for (const layer of layers) {
    if (used.has(layer.id)) continue;
    const group: MotifLayer[] = [];
    for (const point of computeMirroredPoints(layer.point, mode, CANVAS_SIZE)) {
      const match = (pool.get(key(layer, point.x, point.y)) ?? []).find((candidate) => !used.has(candidate.id) && !group.includes(candidate));
      if (!match) return null;
      group.push(match);
    }
    group.forEach((member) => used.add(member.id));
    groups.push(group);
  }
  return groups;
}

/**
 * The symmetry the LAYERS themselves already contain - e.g. a design built
 * from copies placed by hand, or opened from a game with every copy as its
 * own layer. 'none' unless at least one real (off-axis) copy group exists.
 */
export function bakedSymmetry(layers: readonly MotifLayer[]): SymmetryMode {
  for (const mode of ['fourWay', 'mirror'] as const) {
    const groups = orbits(layers, mode);
    if (groups && groups.some((group) => group.length > 1)) return mode;
  }
  return 'none';
}

/** The symmetry a viewer sees: the stronger of the render mode and what the layers already contain. */
export const effectiveSymmetry = (design: RemixDesign): SymmetryMode => {
  const baked = bakedSymmetry(design.layers);
  return RANK[baked] >= RANK[design.symmetry] ? baked : design.symmetry;
};

export type SymmetryOption = { mode: SymmetryMode; available: boolean; reason: 'current' | 'copiesInLayers' | null };
/**
 * Which symmetry modes can be offered. The current effective one is "no
 * change". A WEAKER mode than the copies already in the layers is not
 * offered (it would mean deleting the user's layers). A stronger one keeps
 * one layer per existing copy group, so nothing is mirrored twice.
 */
export function symmetryOptions(design: RemixDesign): SymmetryOption[] {
  const baked = bakedSymmetry(design.layers);
  const current = effectiveSymmetry(design);
  return REMIX_MODES.map((mode) => {
    if (mode === current) return { mode, available: false, reason: 'current' };
    if (RANK[mode] < RANK[baked]) return { mode, available: false, reason: 'copiesInLayers' };
    return { mode, available: true, reason: null };
  });
}

/** Applies a symmetry mode without duplicating copies already in the layers. */
function applySymmetry(design: RemixDesign, mode: SymmetryMode): RemixDesign {
  const baked = bakedSymmetry(design.layers);
  if (RANK[mode] < RANK[baked]) return copyDesign(design); // not offered: never deletes layers
  if (baked === 'none') return { ...copyDesign(design), symmetry: mode };
  // Keep the first layer of every copy group; the render mode recreates the copies.
  const groups = orbits(design.layers, baked) ?? [];
  const keep = new Set(groups.map((group) => group[0].id));
  return { layers: copyLayers(design.layers.filter((layer) => keep.has(layer.id))), backgroundColor: design.backgroundColor, symmetry: mode };
}

/* ---------- palette / background ---------- */

/** Recolours: the design's i-th colour becomes the palette's (i mod n)-th colour. */
function applyPalette(design: RemixDesign, paletteId: PaletteId): RemixDesign {
  const palette = PALETTES.find((entry) => entry.id === paletteId);
  if (!palette) return copyDesign(design);
  const original = designColors(design.layers);
  const mapped = (color: string) => palette.colors[original.findIndex((entry) => same(entry, color)) % palette.colors.length];
  return { ...copyDesign(design), layers: copyLayers(design.layers).map((layer) => ({ ...layer, color: mapped(layer.color) })) };
}

function applyBackground(design: RemixDesign, color: string): RemixDesign {
  // The Creator's own background change.
  const state = setBackgroundColor({ layers: copyLayers(design.layers), backgroundColor: design.backgroundColor, nextId: 0 }, color);
  return { layers: state.layers, backgroundColor: state.backgroundColor, symmetry: design.symmetry };
}

/** The variation: original + chosen changes, always a fresh deep copy. */
export function applyRemix(original: RemixDesign, choice: RemixChoice): RemixDesign {
  let design = copyDesign(original);
  if (choice.palette) design = applyPalette(design, choice.palette);
  if (choice.background) design = applyBackground(design, choice.background);
  if (choice.symmetry) design = applySymmetry(design, choice.symmetry);
  return design;
}

/* ---------- describing the actual change ---------- */

export type Change =
  | { kind: 'palette'; palette: PaletteId; recoloured: number }
  | { kind: 'background'; from: string; to: string }
  | { kind: 'symmetry'; from: SymmetryMode; to: SymmetryMode; mergedLayers: number };

/** What actually differs between original and variation (computed, not assumed). */
export function describeChanges(original: RemixDesign, choice: RemixChoice): Change[] {
  const variation = applyRemix(original, choice);
  const changes: Change[] = [];
  if (choice.palette) {
    const recoloured = original.layers.filter((layer) => {
      const after = applyPalette(original, choice.palette as PaletteId).layers.find((entry) => entry.id === layer.id);
      return after && !same(after.color, layer.color);
    }).length;
    if (recoloured > 0) changes.push({ kind: 'palette', palette: choice.palette, recoloured });
  }
  if (!same(variation.backgroundColor, original.backgroundColor)) changes.push({ kind: 'background', from: original.backgroundColor, to: variation.backgroundColor });
  const from = effectiveSymmetry(original);
  const to = effectiveSymmetry(variation);
  if (from !== to) changes.push({ kind: 'symmetry', from, to, mergedLayers: original.layers.length - variation.layers.length });
  return changes;
}

/** A plain description of one design, for the list alternative to the visual comparison. */
export function describeDesign(design: RemixDesign) {
  const visible = design.layers.filter((layer) => layer.visible);
  return {
    layers: design.layers.length,
    visibleLayers: visible.length,
    shownMotifs: visible.reduce((sum, layer) => sum + computeMirroredPoints(layer.point, design.symmetry, CANVAS_SIZE).length, 0),
    colors: designColors(design.layers),
    backgroundColor: design.backgroundColor,
    symmetry: effectiveSymmetry(design),
  };
}

/** The unsaved Creator copy of a variation - exactly the previewed design. */
export function toCreatorState(design: RemixDesign): { state: OymoEditorState; symmetry: SymmetryMode } {
  const layers = copyLayers(design.layers);
  const ids = layers.map((layer) => Number(/(\d+)$/.exec(layer.id)?.[1] ?? 0));
  return { state: { layers, backgroundColor: design.backgroundColor, nextId: Math.max(layers.length, ...ids.map((id) => id + 1)) }, symmetry: design.symmetry };
}

/* ---------- the design handed from the Creator (in memory, per owner) ---------- */

let source: { owner: string; design: RemixDesign } | null = null;
export function setRemixSource(owner: string, design: RemixDesign): void {
  source = { owner, design: copyDesign(design) };
}
/** Only for the owner who opened it; another account gets nothing (and the slot is cleared). */
export function remixSource(owner: string): RemixDesign | null {
  if (!source) return null;
  if (source.owner !== owner) {
    source = null;
    return null;
  }
  return copyDesign(source.design);
}
