/** How one pin is displaced at zoom 1 (screen px), and the true distance to
 * its closest neighbour, which decides how fast the nudge fades on zoom. */
export type PinSpread = { dx: number; dy: number; nearest: number };

const ITERATIONS = 60;

/**
 * Ala-Too, Suusamyr and Son-Köl are ~22-38 px apart on a phone-width map -
 * closer than one 44 px touch target - so their pins and hit areas would
 * overlap. This relaxes the pins apart (at zoom 1) until every pair is at
 * least `minDistance` apart. Presentation only: the real coordinates are
 * untouched, and pins that are already clear get a zero offset.
 */
export function spreadPins(points: { x: number; y: number }[], minDistance: number): PinSpread[] {
  const shown = points.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    let moved = false;
    for (let a = 0; a < shown.length; a++) {
      for (let b = a + 1; b < shown.length; b++) {
        let dx = shown[b].x - shown[a].x;
        let dy = shown[b].y - shown[a].y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance === 0) {
          dx = 1;
          dy = 0;
          distance = 1;
        }
        // Push a hair past the target so float error can't leave overlap.
        const push = (minDistance + 0.01 - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        shown[a].x -= ux * push;
        shown[a].y -= uy * push;
        shown[b].x += ux * push;
        shown[b].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Every displaced pin fades by the tightest real gap among displaced pins,
  // so a pin pushed along a chain (not by its own nearest neighbour) still
  // keeps its full nudge at zoom 1.
  const movedIndexes = points.flatMap((point, index) => (shown[index].x !== point.x || shown[index].y !== point.y ? [index] : []));
  let nearest = Infinity;
  for (const a of movedIndexes) {
    for (const b of movedIndexes) {
      if (a < b) nearest = Math.min(nearest, Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y));
    }
  }
  return points.map((point, index) =>
    movedIndexes.includes(index) ? { dx: shown[index].x - point.x, dy: shown[index].y - point.y, nearest } : { dx: 0, dy: 0, nearest: Infinity },
  );
}

/**
 * The on-screen nudge at the current zoom: full at zoom 1, fading to zero
 * by the zoom at which the pin's real gap to its nearest neighbour already
 * clears `minDistance` - zoomed in, pins sit exactly on their true spots.
 */
export function pinNudge(spread: PinSpread, minDistance: number, scale: number): { x: number; y: number } {
  'worklet';
  if (spread.dx === 0 && spread.dy === 0) return { x: 0, y: 0 };
  const range = minDistance - spread.nearest;
  const fade = range <= 0 ? 0 : Math.min(1, Math.max(0, (minDistance - spread.nearest * scale) / range));
  if (fade === 0) return { x: 0, y: 0 };
  return { x: spread.dx * fade, y: spread.dy * fade };
}
