import type { Point } from '@/services/culture/symmetry';

/**
 * Oymo canvas viewport - zoom and pan are a VIEW of the artwork, never part
 * of it. Artwork coordinates (what layers store, what symmetry mirrors,
 * what recipes/exports use) stay in the fixed 0..size space; every screen
 * point is mapped back through `screenToArtwork` before it touches a layer.
 *
 * The transform is centred (React Native's default transform origin):
 *   screen = (artwork - c) * zoom + c + pan        c = size / 2
 *   artwork = (screen - c - pan) / zoom + c
 * Pan is clamped so the artwork always covers the frame (no empty edges).
 * Session-only: the viewport is never saved.
 */
export type Viewport = { zoom: number; panX: number; panY: number };

export const IDENTITY: Viewport = { zoom: 1, panX: 0, panY: 0 };
export const ZOOM_STEPS = [1, 1.5, 2, 3] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Movement a tap may have before it counts as a pan (screen px). */
export const TAP_SLOP = 10;
/** Distance a drag needs before it pans (screen px) - below this it can still be a tap. */
export const PAN_THRESHOLD = 12;

/** Numeric movement steps (artwork units). */
export const NUDGE_FINE = 1;
export const NUDGE_COARSE = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function clampViewport(viewport: Viewport, size: number): Viewport {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  const limit = (size / 2) * (zoom - 1);
  // +0 normalises -0 (so a clamped identity is exactly IDENTITY).
  return { zoom, panX: clamp(viewport.panX, -limit, limit) + 0, panY: clamp(viewport.panY, -limit, limit) + 0 };
}

export function screenToArtwork(point: Point, viewport: Viewport, size: number): Point {
  const c = size / 2;
  return { x: (point.x - c - viewport.panX) / viewport.zoom + c, y: (point.y - c - viewport.panY) / viewport.zoom + c };
}

export function artworkToScreen(point: Point, viewport: Viewport, size: number): Point {
  const c = size / 2;
  return { x: (point.x - c) * viewport.zoom + c + viewport.panX, y: (point.y - c) * viewport.zoom + c + viewport.panY };
}

/** Zoom to `zoom`, keeping the artwork point under `focus` (screen) where it is. Default focus: the frame centre. */
export function zoomTo(viewport: Viewport, zoom: number, size: number, focus: Point = { x: size / 2, y: size / 2 }): Viewport {
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const anchor = screenToArtwork(focus, viewport, size);
  const c = size / 2;
  // Solve screen(anchor) == focus for the new zoom.
  return clampViewport({ zoom: next, panX: focus.x - (anchor.x - c) * next - c, panY: focus.y - (anchor.y - c) * next - c }, size);
}

export function zoomIn(viewport: Viewport, size: number): Viewport {
  const next = ZOOM_STEPS.find((step) => step > viewport.zoom + 1e-6) ?? MAX_ZOOM;
  return zoomTo(viewport, next, size);
}

export function zoomOut(viewport: Viewport, size: number): Viewport {
  const next = [...ZOOM_STEPS].reverse().find((step) => step < viewport.zoom - 1e-6) ?? MIN_ZOOM;
  return zoomTo(viewport, next, size);
}

export function panBy(viewport: Viewport, dx: number, dy: number, size: number): Viewport {
  return clampViewport({ ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy }, size);
}

/** A point inside the artwork, on the integer grid layers use for numeric movement. */
export function clampArtworkPoint(point: Point, size: number): Point {
  return { x: Math.round(clamp(point.x, 0, size)), y: Math.round(clamp(point.y, 0, size)) };
}

/** Is a screen point inside the frame (taps outside it are ignored)? */
export const insideFrame = (point: Point, size: number) => point.x >= 0 && point.y >= 0 && point.x <= size && point.y <= size;

/**
 * The topmost visible layer drawn under an artwork point, if any - a tap
 * there selects it instead of placing a new motif. `points` are each
 * layer's mirrored render points (same as the canvas draws); `radius` is
 * the motif's half size at scale 1 (artwork units).
 */
export function hitLayer(layers: readonly { id: string; visible: boolean; scale: number; points: readonly Point[] }[], at: Point, radius: number): string | null {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (!layer.visible) continue;
    const reach = radius * layer.scale;
    if (layer.points.some((point) => Math.hypot(point.x - at.x, point.y - at.y) <= reach)) return layer.id;
  }
  return null;
}

/** Selection handle size on screen: readable at every zoom (never below the touch minimum). */
export function handleSize(motifSize: number, scale: number, zoom: number): number {
  return Math.max(44, Math.round(motifSize * scale * zoom + 8));
}
