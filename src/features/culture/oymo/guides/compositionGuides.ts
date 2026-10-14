import type { Point, SymmetryMode } from '@/services/culture/symmetry';

/**
 * Oymo Creator composition guides - an editing AID, never part of the
 * artwork. Guide and snapping settings live in Creator session state (like
 * zoom/pan); they are never written into layers, recipes, saved designs or
 * exports. Every value here is in ARTWORK units (0..size), so a point snaps
 * identically at every zoom level and pan position.
 *
 * Guides:
 *   - grid: lines every `spacing` units (GRID_SPACINGS all divide 300, so the
 *     grid is symmetric about the centre and works with every symmetry mode);
 *   - axes: the vertical and horizontal centre lines;
 *   - margins: a safe margin SAFE_MARGIN units in from each edge, where a
 *     motif at normal size is fully clear of the frame's edge and rounded
 *     corners. A layout aid only - not a rule of the craft.
 *
 * Snapping: only to guides that are SHOWN, per axis, when the point is
 * within SNAP_DISTANCE (inclusive) of a guide line; the nearest line wins,
 * and on a tie the centre axis, then the margin, then the grid. Snapping
 * moves the layer's own point; mirrored copies follow from the symmetry
 * (the guides are symmetric, so a copy lands on the mirrored guide).
 */
export type GridSpacing = 10 | 25 | 50;
export const GRID_SPACINGS: readonly GridSpacing[] = [10, 25, 50];
export const SAFE_MARGIN = 30;
export const SNAP_DISTANCE = 6;

export type GuideKind = 'axis' | 'margin' | 'grid';
export type GuideSettings = { grid: boolean; axes: boolean; margins: boolean; spacing: GridSpacing; snap: boolean };
export const DEFAULT_GUIDES: GuideSettings = { grid: false, axes: false, margins: false, spacing: 25, snap: true };

export const anyGuideShown = (settings: GuideSettings) => settings.grid || settings.axes || settings.margins;
/** Is snapping in effect? Only with a guide to snap to, and not while free placement is held. */
export const snapActive = (settings: GuideSettings, freeHeld = false) => settings.snap && anyGuideShown(settings) && !freeHeld;

const PRIORITY: Record<GuideKind, number> = { axis: 0, margin: 1, grid: 2 };

/** The guide lines on one axis (both axes use the same set - the canvas is square). */
export function guideLines(settings: GuideSettings, size: number): { value: number; kind: GuideKind }[] {
  const lines: { value: number; kind: GuideKind }[] = [];
  if (settings.axes) lines.push({ value: size / 2, kind: 'axis' });
  if (settings.margins) lines.push({ value: SAFE_MARGIN, kind: 'margin' }, { value: size - SAFE_MARGIN, kind: 'margin' });
  if (settings.grid) for (let value = settings.spacing; value < size; value += settings.spacing) lines.push({ value, kind: 'grid' });
  return lines;
}

export type AxisSnap = { value: number; kind: GuideKind | null };

export function snapAxis(value: number, lines: readonly { value: number; kind: GuideKind }[], distance = SNAP_DISTANCE): AxisSnap {
  let best: { value: number; kind: GuideKind; gap: number } | null = null;
  for (const line of lines) {
    const gap = Math.abs(line.value - value);
    if (gap > distance + 1e-9) continue;
    if (!best || gap < best.gap - 1e-9 || (Math.abs(gap - best.gap) <= 1e-9 && PRIORITY[line.kind] < PRIORITY[best.kind])) best = { ...line, gap };
  }
  return best ? { value: best.value, kind: best.kind } : { value, kind: null };
}

export type SnapResult = { point: Point; x: GuideKind | null; y: GuideKind | null };

/**
 * Where a point goes: snapped (if active) then clamped to the artwork and the
 * integer grid layers use. Pure artwork-space maths - zoom/pan never enter.
 */
export function placePoint(point: Point, settings: GuideSettings, size: number, freeHeld = false): SnapResult {
  const round = (n: number) => Math.round(Math.min(size, Math.max(0, n)));
  if (!snapActive(settings, freeHeld)) return { point: { x: round(point.x), y: round(point.y) }, x: null, y: null };
  const lines = guideLines(settings, size);
  const x = snapAxis(point.x, lines);
  const y = snapAxis(point.y, lines);
  return { point: { x: round(x.value), y: round(y.value) }, x: x.kind, y: y.kind };
}

/**
 * Dragging a mirrored COPY of a layer moves the layer's own point by the
 * mirrored movement. Returns the reflection that maps the layer's point to
 * the grabbed copy (each reflection is its own inverse).
 */
export type Reflection = { flipX: boolean; flipY: boolean };
export function reflectionFor(mode: SymmetryMode): Reflection[] {
  if (mode === 'none') return [{ flipX: false, flipY: false }];
  if (mode === 'mirror')
    return [
      { flipX: false, flipY: false },
      { flipX: true, flipY: false },
    ];
  return [
    { flipX: false, flipY: false },
    { flipX: true, flipY: false },
    { flipX: false, flipY: true },
    { flipX: true, flipY: true },
  ];
}
export const reflect = (point: Point, r: Reflection, size: number): Point => ({ x: r.flipX ? size - point.x : point.x, y: r.flipY ? size - point.y : point.y });

/** The reflection whose copy of `layerPoint` is nearest `grabbed` (the copy under the finger). */
export function grabbedReflection(layerPoint: Point, grabbed: Point, mode: SymmetryMode, size: number): Reflection {
  let best = reflectionFor(mode)[0];
  let bestGap = Infinity;
  for (const r of reflectionFor(mode)) {
    const copy = reflect(layerPoint, r, size);
    const gap = Math.hypot(copy.x - grabbed.x, copy.y - grabbed.y);
    if (gap < bestGap - 1e-9) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * One drag of the selected layer, in artwork space. `grabOffset` keeps the
 * motif where it was under the finger (no jump to the finger's centre).
 * The returned point is the layer's OWN point (snapped, clamped, integer).
 */
export type DragStart = { layerId: string; reflection: Reflection; grabOffset: Point };
export function startDrag(layerId: string, layerPoint: Point, fingerArtwork: Point, mode: SymmetryMode, size: number): DragStart {
  const reflection = grabbedReflection(layerPoint, fingerArtwork, mode, size);
  const copy = reflect(layerPoint, reflection, size);
  return { layerId, reflection, grabOffset: { x: copy.x - fingerArtwork.x, y: copy.y - fingerArtwork.y } };
}
export function dragPoint(drag: DragStart, fingerArtwork: Point, settings: GuideSettings, size: number, freeHeld = false): SnapResult {
  const copy = { x: fingerArtwork.x + drag.grabOffset.x, y: fingerArtwork.y + drag.grabOffset.y };
  return placePoint(reflect(copy, drag.reflection, size), settings, size, freeHeld);
}
