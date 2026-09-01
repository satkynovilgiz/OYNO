/**
 * Shared mirroring math for both Oymo Creator and Shyrdak Creator - kept
 * free of React/RN so it's trivially unit-testable and reusable regardless
 * of how each editor renders its canvas.
 */
export type SymmetryMode = 'none' | 'mirror' | 'fourWay';

export type Point = { x: number; y: number };

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
