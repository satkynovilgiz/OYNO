/**
 * Pure state/logic for the Oymo Creator Phase 1 canvas: single-motif
 * placement + symmetry mirroring only. No layer stack, no
 * rotate/resize/duplicate transforms, no undo/redo - those are Phase 2/3
 * (see docs/plan for the confirmed phasing). Kept free of React/RN so it's
 * trivially unit-testable and reusable if the canvas rendering approach
 * changes later.
 */
export type SymmetryMode = 'none' | 'mirror' | 'fourWay';

export type Point = { x: number; y: number };

export type MotifPlacement = {
  id: string;
  x: number;
  y: number;
  motifId: string;
  color: string;
};

export type OymoEditorState = {
  placements: MotifPlacement[];
  nextId: number;
};

export const EMPTY_OYMO_STATE: OymoEditorState = { placements: [], nextId: 0 };

/** Rounds to avoid float-precision near-duplicates (e.g. tapping dead
 * center in fourWay mode should collapse to one point, not four). */
function dedupePoints(points: Point[]): Point[] {
  const seen = new Map<string, Point>();
  for (const point of points) {
    const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
    seen.set(`${rounded.x},${rounded.y}`, rounded);
  }
  return Array.from(seen.values());
}

/**
 * None -> the tapped point only.
 * Mirror -> also reflected across the vertical center axis.
 * FourWay -> reflected across both axes (4 quadrants).
 */
export function computeMirroredPoints(point: Point, mode: SymmetryMode, canvasSize: number): Point[] {
  const mirroredX = canvasSize - point.x;
  const mirroredY = canvasSize - point.y;

  if (mode === 'none') return [point];
  if (mode === 'mirror') return dedupePoints([point, { x: mirroredX, y: point.y }]);
  return dedupePoints([
    point,
    { x: mirroredX, y: point.y },
    { x: point.x, y: mirroredY },
    { x: mirroredX, y: mirroredY },
  ]);
}

export function placeMotif(
  state: OymoEditorState,
  point: Point,
  motifId: string,
  color: string,
  symmetryMode: SymmetryMode,
  canvasSize: number,
): OymoEditorState {
  const points = computeMirroredPoints(point, symmetryMode, canvasSize);
  const newPlacements: MotifPlacement[] = points.map((p, index) => ({
    id: `p${state.nextId + index}`,
    x: p.x,
    y: p.y,
    motifId,
    color,
  }));
  return {
    placements: [...state.placements, ...newPlacements],
    nextId: state.nextId + points.length,
  };
}

export function removeMotif(state: OymoEditorState, placementId: string): OymoEditorState {
  return { ...state, placements: state.placements.filter((p) => p.id !== placementId) };
}

export function resetCanvas(): OymoEditorState {
  return EMPTY_OYMO_STATE;
}
